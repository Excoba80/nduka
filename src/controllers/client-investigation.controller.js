'use strict';

const clientInvestigationService =
    require('../services/client-investigation.service');

const auditService =
    require('../services/audit.service');


/**
 * Display all investigations belonging to the authenticated Client.
 */
async function index(req, res) {

    try {

        const userId =
            Number(req.session.user.id);

        const investigations =
            await clientInvestigationService.getMyInvestigations(userId);


        res.render(
            'client-investigations/index',
            {
                title: 'My Investigations',
                investigations
            }
        );

    } catch (error) {

        console.error(
            'Error loading client investigations:',
            error
        );

        res.status(500).render(
            'error',
            {
                title: 'Error',
                message:
                    'Unable to load your investigations at this time.'
            }
        );

    }

}


/**
 * Display one investigation belonging to the authenticated Client.
 *
 * Ownership is enforced by the service layer.
 */
async function show(req, res) {

    try {

        const userId =
            Number(req.session.user.id);

        const caseId =
            Number(req.params.id);


        if (!Number.isInteger(caseId) || caseId <= 0) {

            return res.status(404).render(
                'error',
                {
                    title: 'Investigation Not Found',
                    message:
                        'The requested investigation could not be found.'
                }
            );

        }


        const investigation =
            await clientInvestigationService
                .getMyInvestigationById(
                    userId,
                    caseId
                );


        if (!investigation) {

            return res.status(404).render(
                'error',
                {
                    title: 'Investigation Not Found',
                    message:
                        'The requested investigation could not be found.'
                }
            );

        }


        return res.render(
            'client-investigations/show',
            {
                title: 'Investigation Details',
                investigation
            }
        );

    } catch (error) {

        console.error(
            'Error loading client investigation:',
            error
        );

        return res.status(500).render(
            'error',
            {
                title: 'Error',
                message:
                    'Unable to load this investigation at this time.'
            }
        );

    }

}



/**
 * Display one APPROVED Report belonging to a Case owned
 * by the authenticated Client User.
 *
 * Ownership and APPROVED visibility are enforced by the
 * service layer.
 */
async function viewReport(req, res) {

    try {

        const userId =
            Number(req.session.user.id);

        const caseId =
            Number(req.params.id);

        const reportId =
            Number(req.params.reportId);


        if (
            !Number.isInteger(caseId) ||
            caseId <= 0 ||
            !Number.isInteger(reportId) ||
            reportId <= 0
        ) {

            return res.status(404).render(
                'error',
                {
                    title: 'Report Not Found',
                    message:
                        'The requested report could not be found.'
                }
            );

        }


        const report =
            await clientInvestigationService
                .getMyApprovedReportById(
                    userId,
                    caseId,
                    reportId
                );


        if (!report) {

            return res.status(404).render(
                'error',
                {
                    title: 'Report Not Found',
                    message:
                        'The requested report could not be found.'
                }
            );

        }


        /*
         * Record client access to the approved report.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'VIEW_CLIENT_REPORT',

                targetUserId:
                    null,

                description:
                    `Client viewed approved report ${report.report_number} for Case ${report.case_reference}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record VIEW_CLIENT_REPORT audit:',
                auditError
            );

        }


        return res.render(
            'client-investigations/report',
            {
                title: 'Investigation Report',
                report
            }
        );

    } catch (error) {

        console.error(
            'Error loading client investigation report:',
            error
        );

        return res.status(500).render(
            'error',
            {
                title: 'Error',
                message:
                    'Unable to load this report at this time.'
            }
        );

    }

}


module.exports = {
    index,
    show,
    viewReport
};