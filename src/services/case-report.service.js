'use strict';

const pool = require('../config/database');


/**
 * Get all Reports belonging to a Case.
 *
 * Reports are ordered newest first.
 *
 * @param {number} caseId
 * @returns {Promise<Array>}
 */
async function getReportsByCaseId(caseId) {

    const [reports] = await pool.execute(
        `
        SELECT
            cr.id,
            cr.case_id,
            cr.report_status_id,
            cr.created_by,
            cr.approved_by,
            cr.report_number,
            cr.report_type,
            cr.report_title,
            cr.executive_summary,
            cr.findings,
            cr.conclusion,
            cr.recommendations,
            cr.approved_at,
            cr.created_at,
            cr.updated_at,

            rs.code AS report_status_code,
            rs.name AS report_status_name,
            rs.description AS report_status_description,
            rs.is_terminal AS report_status_is_terminal,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.middle_name AS created_by_middle_name,
            creator.last_name AS created_by_last_name,

            approver.username AS approved_by_username,
            approver.first_name AS approved_by_first_name,
            approver.middle_name AS approved_by_middle_name,
            approver.last_name AS approved_by_last_name

        FROM case_reports cr

        INNER JOIN report_statuses rs
            ON rs.id = cr.report_status_id

        INNER JOIN users creator
            ON creator.id = cr.created_by

        LEFT JOIN users approver
            ON approver.id = cr.approved_by

        WHERE cr.case_id = ?

        ORDER BY
            cr.created_at DESC,
            cr.id DESC
        `,
        [caseId]
    );

    return reports;
}


/**
 * Get a single Case Report by ID.
 *
 * @param {number} reportId
 * @returns {Promise<Object|null>}
 */
async function getReportById(reportId) {

    const [reports] = await pool.execute(
        `
        SELECT
            cr.id,
            cr.case_id,
            cr.report_status_id,
            cr.created_by,
            cr.approved_by,
            cr.report_number,
            cr.report_type,
            cr.report_title,
            cr.executive_summary,
            cr.findings,
            cr.conclusion,
            cr.recommendations,
            cr.approved_at,
            cr.created_at,
            cr.updated_at,

            rs.code AS report_status_code,
            rs.name AS report_status_name,
            rs.description AS report_status_description,
            rs.is_terminal AS report_status_is_terminal,

            creator.username AS created_by_username,
            creator.first_name AS created_by_first_name,
            creator.middle_name AS created_by_middle_name,
            creator.last_name AS created_by_last_name,

            approver.username AS approved_by_username,
            approver.first_name AS approved_by_first_name,
            approver.middle_name AS approved_by_middle_name,
            approver.last_name AS approved_by_last_name

        FROM case_reports cr

        INNER JOIN report_statuses rs
            ON rs.id = cr.report_status_id

        INNER JOIN users creator
            ON creator.id = cr.created_by

        LEFT JOIN users approver
            ON approver.id = cr.approved_by

        WHERE cr.id = ?

        LIMIT 1
        `,
        [reportId]
    );

    if (reports.length === 0) {
        return null;
    }

    return reports[0];
}


/**
 * Get all active Report statuses.
 *
 * Ordered according to the configured display order.
 *
 * @returns {Promise<Array>}
 */
async function getReportStatuses() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order,
            is_active,
            is_default,
            is_terminal

        FROM report_statuses

        WHERE is_active = 1

        ORDER BY
            display_order ASC,
            id ASC
        `
    );

    return statuses;
}


/**
 * Get the default Report status.
 *
 * @returns {Promise<Object|null>}
 */
async function getDefaultReportStatus() {

    const [statuses] = await pool.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            display_order,
            is_active,
            is_default,
            is_terminal

        FROM report_statuses

        WHERE is_active = 1
          AND is_default = 1

        LIMIT 1
        `
    );

    if (statuses.length === 0) {
        return null;
    }

    return statuses[0];
}


/**
 * Confirm that a Report belongs to a Case.
 *
 * @param {number} reportId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
async function reportBelongsToCase(
    reportId,
    caseId
) {

    const [reports] = await pool.execute(
        `
        SELECT
            id
        FROM case_reports
        WHERE id = ?
          AND case_id = ?
        LIMIT 1
        `,
        [
            reportId,
            caseId
        ]
    );

    return reports.length > 0;
}


/**
 * Generate the next Report number for a Case.
 *
 * The generated value is kept within the
 * 30-character database limit.
 *
 * @param {Object} connection
 * @param {number} caseId
 * @param {string} caseReference
 * @returns {Promise<string>}
 */
async function generateReportNumber(
    connection,
    caseId,
    caseReference
) {

    const [rows] =
        await connection.execute(
            `
            SELECT
                COUNT(*) AS report_count
            FROM case_reports
            WHERE case_id = ?
            `,
            [caseId]
        );


    const nextNumber =
        Number(rows[0].report_count || 0) + 1;


    /*
     * Keep the sequence padded to four digits.
     */
    const sequence =
        String(nextNumber).padStart(4, '0');


    /*
     * RPT- + case reference + - + sequence
     *
     * If the Case reference is longer than
     * necessary, trim it to preserve the
     * database's 30-character limit.
     */
    const prefix =
        `RPT-${caseReference}-`;


    const availableLength =
        30 -
        prefix.length -
        sequence.length;


    if (availableLength < 0) {

        throw new Error(
            'Unable to generate a valid Case Report number.'
        );
    }


    const trimmedReference =
        caseReference.substring(
            0,
            Math.max(
                0,
                availableLength +
                caseReference.length
            )
        );


    const reportNumber =
        `RPT-${trimmedReference}-${sequence}`;


    return reportNumber.substring(0, 30);
}


/**
 * Create a new Case Report.
 *
 * New Reports always begin in the default
 * report status, normally DRAFT.
 *
 * @param {number} caseId
 * @param {number} createdBy
 * @param {Object} data
 * @returns {Promise<number>}
 */
async function createReport(
    caseId,
    createdBy,
    data
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Confirm that the Case exists.
         */
        const [cases] =
            await connection.execute(
                `
                SELECT
                    id,
                    case_reference
                FROM cases
                WHERE id = ?
                LIMIT 1
                `,
                [caseId]
            );


        if (cases.length === 0) {

            throw new Error(
                'Case not found.'
            );
        }


        /*
         * Retrieve the default Report status.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM report_statuses
                WHERE is_active = 1
                  AND is_default = 1
                LIMIT 1
                `
            );


        if (statuses.length === 0) {

            throw new Error(
                'Default Case Report status is not configured.'
            );
        }


        const defaultStatus =
            statuses[0];


        if (defaultStatus.is_terminal) {

            throw new Error(
                'The default Case Report status cannot be terminal.'
            );
        }


        /*
         * Generate a unique Report number.
         */
        const reportNumber =
            await generateReportNumber(
                connection,
                caseId,
                cases[0].case_reference
            );


        /*
         * Create the Report.
         */
        const [result] =
            await connection.execute(
                `
                INSERT INTO case_reports (
                    case_id,
                    report_status_id,
                    created_by,
                    report_number,
                    report_type,
                    report_title,
                    executive_summary,
                    findings,
                    conclusion,
                    recommendations
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    caseId,
                    defaultStatus.id,
                    createdBy,
                    reportNumber,
                    data.reportType || 'FINAL',
                    data.reportTitle,
                    data.executiveSummary || null,
                    data.findings || null,
                    data.conclusion || null,
                    data.recommendations || null
                ]
            );


        await connection.commit();

        return result.insertId;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Update a Case Report.
 *
 * Only report information is changed.
 * Case ownership, creator, status, approval
 * information and report number are preserved.
 *
 * @param {number} reportId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function updateReport(
    reportId,
    data
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        /*
         * Retrieve the existing Report.
         */
        const [reports] =
            await connection.execute(
                `
                SELECT
                    id,
                    report_status_id
                FROM case_reports
                WHERE id = ?
                LIMIT 1
                `,
                [reportId]
            );


        if (reports.length === 0) {

            throw new Error(
                'Case report not found.'
            );
        }


        /*
         * Retrieve the Report status.
         */
        const [statuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    code,
                    is_terminal
                FROM report_statuses
                WHERE id = ?
                LIMIT 1
                `,
                [reports[0].report_status_id]
            );


        if (
            statuses.length === 0
        ) {

            throw new Error(
                'Case Report status not found.'
            );
        }


        if (statuses[0].is_terminal) {

            throw new Error(
                'Approved Case Reports cannot be modified.'
            );
        }


        /*
         * Update the Report.
         *
         * case_id, created_by, report_number,
         * status and approval fields are
         * deliberately not changed.
         */
        await connection.execute(
            `
            UPDATE case_reports
            SET
                report_type = ?,
                report_title = ?,
                executive_summary = ?,
                findings = ?,
                conclusion = ?,
                recommendations = ?
            WHERE id = ?
            `,
            [
                data.reportType || 'FINAL',
                data.reportTitle,
                data.executiveSummary || null,
                data.findings || null,
                data.conclusion || null,
                data.recommendations || null,
                reportId
            ]
        );


        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Submit a Draft or Rejected Case Report.
 *
 * Only DRAFT and REJECTED Reports may
 * transition to SUBMITTED.
 *
 * @param {number} reportId
 * @returns {Promise<void>}
 */
async function submitReport(reportId) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        const [reports] =
            await connection.execute(
                `
                SELECT
                    cr.id,
                    rs.code AS status_code
                FROM case_reports cr
                INNER JOIN report_statuses rs
                    ON rs.id = cr.report_status_id
                WHERE cr.id = ?
                LIMIT 1
                `,
                [reportId]
            );


        if (reports.length === 0) {

            throw new Error(
                'Case report not found.'
            );
        }


        if (
            reports[0].status_code !== 'DRAFT' &&
            reports[0].status_code !== 'REJECTED'
        ) {

            throw new Error(
                'Only Draft or Rejected Case Reports can be submitted.'
            );
        }


        const [submittedStatuses] =
            await connection.execute(
                `
                SELECT
                    id
                FROM report_statuses
                WHERE code = 'SUBMITTED'
                  AND is_active = 1
                LIMIT 1
                `
            );


        if (submittedStatuses.length === 0) {

            throw new Error(
                'Submitted Case Report status is not configured.'
            );
        }


        await connection.execute(
            `
            UPDATE case_reports
            SET
                report_status_id = ?,
                approved_by = NULL,
                approved_at = NULL
            WHERE id = ?
            `,
            [
                submittedStatuses[0].id,
                reportId
            ]
        );


        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Approve a submitted Case Report.
 *
 * Approval is a terminal transition.
 *
 * @param {number} reportId
 * @param {number} approvedBy
 * @returns {Promise<void>}
 */
async function approveReport(
    reportId,
    approvedBy
) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        const [reports] =
            await connection.execute(
                `
                SELECT
                    cr.id,
                    rs.code AS status_code
                FROM case_reports cr
                INNER JOIN report_statuses rs
                    ON rs.id = cr.report_status_id
                WHERE cr.id = ?
                LIMIT 1
                `,
                [reportId]
            );


        if (reports.length === 0) {

            throw new Error(
                'Case report not found.'
            );
        }


        if (
            reports[0].status_code !== 'SUBMITTED'
        ) {

            throw new Error(
                'Only Submitted Case Reports can be approved.'
            );
        }


        const [approvedStatuses] =
            await connection.execute(
                `
                SELECT
                    id,
                    is_terminal
                FROM report_statuses
                WHERE code = 'APPROVED'
                  AND is_active = 1
                LIMIT 1
                `
            );


        if (approvedStatuses.length === 0) {

            throw new Error(
                'Approved Case Report status is not configured.'
            );
        }


        if (!approvedStatuses[0].is_terminal) {

            throw new Error(
                'Approved Case Report status must be terminal.'
            );
        }


        await connection.execute(
            `
            UPDATE case_reports
            SET
                report_status_id = ?,
                approved_by = ?,
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                approvedStatuses[0].id,
                approvedBy,
                reportId
            ]
        );


        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


/**
 * Reject a submitted Case Report.
 *
 * Rejected Reports can subsequently be
 * edited and resubmitted.
 *
 * @param {number} reportId
 * @returns {Promise<void>}
 */
async function rejectReport(reportId) {

    const connection =
        await pool.getConnection();

    try {

        await connection.beginTransaction();


        const [reports] =
            await connection.execute(
                `
                SELECT
                    cr.id,
                    rs.code AS status_code
                FROM case_reports cr
                INNER JOIN report_statuses rs
                    ON rs.id = cr.report_status_id
                WHERE cr.id = ?
                LIMIT 1
                `,
                [reportId]
            );


        if (reports.length === 0) {

            throw new Error(
                'Case report not found.'
            );
        }


        if (
            reports[0].status_code !== 'SUBMITTED'
        ) {

            throw new Error(
                'Only Submitted Case Reports can be rejected.'
            );
        }


        const [rejectedStatuses] =
            await connection.execute(
                `
                SELECT
                    id
                FROM report_statuses
                WHERE code = 'REJECTED'
                  AND is_active = 1
                LIMIT 1
                `
            );


        if (rejectedStatuses.length === 0) {

            throw new Error(
                'Rejected Case Report status is not configured.'
            );
        }


        await connection.execute(
            `
            UPDATE case_reports
            SET
                report_status_id = ?,
                approved_by = NULL,
                approved_at = NULL
            WHERE id = ?
            `,
            [
                rejectedStatuses[0].id,
                reportId
            ]
        );


        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }
}


module.exports = {
    getReportsByCaseId,
    getReportById,
    getReportStatuses,
    getDefaultReportStatus,
    reportBelongsToCase,
    createReport,
    updateReport,
    submitReport,
    approveReport,
    rejectReport
};
