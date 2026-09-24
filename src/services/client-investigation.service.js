'use strict';

const pool = require('../config/database');


/**
 * Resolve the Client linked to an authenticated User.
 *
 * A Client User is connected to a Client through
 * client_user_accounts.
 *
 * @param {number} userId
 * @returns {Promise<number|null>}
 */
async function getClientIdForUser(userId) {

    const [rows] =
        await pool.execute(
            `
            SELECT
                client_id
            FROM client_user_accounts
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId]
        );


    if (rows.length === 0) {
        return null;
    }


    return Number(rows[0].client_id);
}


/**
 * Get all Cases belonging to the authenticated Client User.
 *
 * Ownership is enforced through client_user_accounts rather
 * than trusting a client ID supplied by the browser.
 *
 * Only client-safe Case information is returned.
 *
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getMyInvestigations(userId) {

    const [cases] =
        await pool.execute(
            `
            SELECT
                c.id,
                c.case_reference,
                c.created_at,
                c.opened_at,
                c.closed_at,

                cs.code AS status_code,
                cs.name AS status_name,
                cs.description AS status_description,
                cs.display_order AS status_display_order,
                cs.is_terminal AS status_is_terminal,

                ir.id AS investigation_request_id,
                ir.request_reference,
                ir.status AS request_status

            FROM client_user_accounts cua

            INNER JOIN cases c
                ON c.client_id = cua.client_id

            INNER JOIN case_statuses cs
                ON cs.id = c.case_status_id

            LEFT JOIN investigation_requests ir
                ON ir.case_id = c.id

            WHERE cua.user_id = ?

            ORDER BY
                c.id DESC
            `,
            [userId]
        );


    return cases;
}


/**
 * Get one Case belonging to the authenticated Client User.
 *
 * Ownership is enforced inside the query.
 *
 * The returned object contains only information intended
 * for Client Case Monitoring.
 *
 * @param {number} userId
 * @param {number} caseId
 * @returns {Promise<Object|null>}
 */
async function getMyInvestigationById(userId, caseId) {

    const [caseRows] =
        await pool.execute(
            `
            SELECT
                c.id,
                c.case_reference,
                c.created_at,
                c.opened_at,
                c.closed_at,

                cs.code AS status_code,
                cs.name AS status_name,
                cs.description AS status_description,
                cs.display_order AS status_display_order,
                cs.is_terminal AS status_is_terminal,

                ir.id AS investigation_request_id,
                ir.request_reference,
                ir.status AS request_status

            FROM client_user_accounts cua

            INNER JOIN cases c
                ON c.client_id = cua.client_id

            INNER JOIN case_statuses cs
                ON cs.id = c.case_status_id

            LEFT JOIN investigation_requests ir
                ON ir.case_id = c.id

            WHERE cua.user_id = ?
              AND c.id = ?

            LIMIT 1
            `,
            [userId, caseId]
        );


    if (caseRows.length === 0) {
        return null;
    }


    const result = {
        case: caseRows[0],
        services: [],
        payment: null,
        reports: []
    };


    /*
     * Investigation Services
     *
     * Only information suitable for Client Case Monitoring
     * is returned. Internal assignment, creator, completer
     * and service notes are deliberately excluded.
     */
    const [serviceRows] =
        await pool.execute(
            `
            SELECT
                cis.id,
                cis.investigation_type_id,
                cis.display_order,
                cis.started_at,
                cis.completed_at,

                it.code AS investigation_type_code,
                it.name AS investigation_type_name,
                it.description AS investigation_type_description,

                ss.code AS service_status_code,
                ss.name AS service_status_name,
                ss.description AS service_status_description,
                ss.display_order AS service_status_display_order,
                ss.is_terminal AS service_status_is_terminal

            FROM case_investigation_services cis

            INNER JOIN investigation_types it
                ON it.id = cis.investigation_type_id

            INNER JOIN service_statuses ss
                ON ss.id = cis.service_status_id

            WHERE cis.case_id = ?

            ORDER BY
                cis.display_order ASC,
                cis.id ASC
            `,
            [caseRows[0].id]
        );


    result.services =
        serviceRows;


    /*
     * Payment
     *
     * Payment belongs to the originating Investigation Request.
     * Only public-safe payment information is returned.
     */
    if (caseRows[0].investigation_request_id) {

        const [paymentRows] =
            await pool.execute(
                `
                SELECT
                    payment_reference,
                    amount,
                    currency,
                    status,
                    initiated_at,
                    paid_at,
                    created_at
                FROM investigation_request_payments
                WHERE investigation_request_id = ?
                ORDER BY
                    id DESC
                LIMIT 1
                `,
                [caseRows[0].investigation_request_id]
            );


        if (paymentRows.length > 0) {

            result.payment = {
                paymentReference:
                    paymentRows[0].payment_reference,

                amount:
                    Number(paymentRows[0].amount || 0),

                currency:
                    paymentRows[0].currency,

                status:
                    paymentRows[0].status,

                initiatedAt:
                    paymentRows[0].initiated_at,

                paidAt:
                    paymentRows[0].paid_at,

                createdAt:
                    paymentRows[0].created_at
            };

        }

    }


    /*
     * Reports
     *
     * Only APPROVED reports are visible to the Client.
     *
     * Report contents are deliberately excluded at this stage.
     * The Client portal only needs to know that an approved
     * report exists until a separate report-viewing policy
     * is implemented.
     */
    const [reportRows] =
        await pool.execute(
            `
            SELECT
                cr.id,
                cr.report_number,
                cr.report_type,
                cr.report_title,
                cr.approved_at,
                cr.created_at,

                rs.code AS report_status_code,
                rs.name AS report_status_name

            FROM case_reports cr

            INNER JOIN report_statuses rs
                ON rs.id = cr.report_status_id

            WHERE cr.case_id = ?
              AND rs.code = 'APPROVED'

            ORDER BY
                cr.approved_at DESC,
                cr.id DESC
            `,
            [caseRows[0].id]
        );


    result.reports =
        reportRows;


    return result;
}


/**
 * Get one APPROVED Report belonging to a Case owned by
 * the authenticated Client User.
 *
 * Ownership and report visibility are enforced together
 * inside the query.
 *
 * Only report content intended for the Client is returned.
 *
 * @param {number} userId
 * @param {number} caseId
 * @param {number} reportId
 * @returns {Promise<Object|null>}
 */
async function getMyApprovedReportById(
    userId,
    caseId,
    reportId
) {

    const [rows] =
        await pool.execute(
            `
            SELECT
                cr.id,
                cr.report_number,
                cr.report_type,
                cr.report_title,
                cr.executive_summary,
                cr.findings,
                cr.conclusion,
                cr.recommendations,
                cr.approved_at,

                c.id AS case_id,
                c.case_reference,

                ir.request_reference,

                rs.code AS report_status_code,
                rs.name AS report_status_name

            FROM client_user_accounts cua

            INNER JOIN cases c
                ON c.client_id = cua.client_id

            INNER JOIN case_reports cr
                ON cr.case_id = c.id

            INNER JOIN report_statuses rs
                ON rs.id = cr.report_status_id

            LEFT JOIN investigation_requests ir
                ON ir.case_id = c.id

            WHERE cua.user_id = ?
              AND c.id = ?
              AND cr.id = ?
              AND rs.code = 'APPROVED'

            LIMIT 1
            `,
            [
                userId,
                caseId,
                reportId
            ]
        );


    if (rows.length === 0) {
        return null;
    }


    return rows[0];
}


module.exports = {
    getClientIdForUser,
    getMyInvestigations,
    getMyInvestigationById,
    getMyApprovedReportById
};
