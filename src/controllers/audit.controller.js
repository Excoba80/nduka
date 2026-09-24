'use strict';

const auditService = require('../services/audit.service');


/**
 * Display the audit log.
 *
 * GET /audit
 */
async function index(req, res, next) {

    try {

        const page = Number(req.query.page) || 1;

        const action =
            typeof req.query.action === 'string' &&
            req.query.action.trim() !== ''
                ? req.query.action.trim()
                : null;

        /*
         * Retrieve audit records, available actions,
         * and audit statistics.
         */
        const [
            auditData,
            actions,
            stats
        ] = await Promise.all([
            auditService.getLogs({
                page,
                limit: 25,
                action
            }),
            auditService.getActions(),
            auditService.getStats(action)
        ]);

        return res.render('audit/index', {
            title: 'Audit Logs',
            logs: auditData.rows,
            pagination: auditData.pagination,
            actions,
            stats,
            filters: {
                action
            }
        });

    } catch (error) {

        next(error);
    }
}


/**
 * Display a single audit-log record.
 *
 * GET /audit/:id
 */
async function show(req, res, next) {

    try {

        const auditId = Number(req.params.id);

        /*
         * Validate audit ID.
         */
        if (!Number.isInteger(auditId) || auditId <= 0) {

            return res.status(404).render('error', {
                title: 'Audit Record Not Found',
                message: 'The requested audit record could not be found.'
            });
        }

        /*
         * Retrieve the audit record.
         */
        const log = await auditService.getLogById(auditId);

        /*
         * Audit record does not exist.
         */
        if (!log) {

            return res.status(404).render('error', {
                title: 'Audit Record Not Found',
                message: 'The requested audit record could not be found.'
            });
        }

        return res.render('audit/show', {
            title: 'Audit Record',
            log
        });

    } catch (error) {

        next(error);
    }
}


module.exports = {
    index,
    show
};