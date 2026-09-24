'use strict';

const caseReportService =
require('../services/case-report.service');

const caseService =
require('../services/case.service');

const auditService =
require('../services/audit.service');

/**

* Display all Reports belonging to a Case.
*
* Case visibility is enforced through
* caseService.getCaseById().
  */
  async function index(req, res, next) {

  try {

   const caseId =
       Number(req.params.id);


   if (
       !Number.isInteger(caseId) ||
       caseId <= 0
   ) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   /*
    * Confirm that the authenticated user
    * can see this Case.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   const reports =
       await caseReportService
           .getReportsByCaseId(caseId);


   res.render('cases/reports/index', {
       title: 'Case Reports',
       caseRecord,
       reports
   });

  } catch (error) {

   next(error);

  }
  }

/**

* Display the Add Case Report form.
  */
  async function createForm(req, res, next) {

  try {

   const caseId =
       Number(req.params.id);


   if (
       !Number.isInteger(caseId) ||
       caseId <= 0
   ) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   /*
    * Terminal Cases cannot receive
    * new Reports.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Create Case Report',
           message:
               'Reports cannot be created because this Case has reached a terminal status.'
       });
   }


   res.render('cases/reports/new', {
       title: 'Create Case Report',
       caseRecord,
       error: null,
       formData: {}
   });

  } catch (error) {

   next(error);

  }
  }

/**

* Create a new Case Report.
  */
  async function create(req, res, next) {

  const caseId =
  Number(req.params.id);

  const {
  report_type,
  report_title,
  executive_summary,
  findings,
  conclusion,
  recommendations
  } = req.body;

  const formData = {
  report_type,
  report_title,
  executive_summary,
  findings,
  conclusion,
  recommendations
  };

  try {

   /*
    * Validate Case ID.
    */
   if (
       !Number.isInteger(caseId) ||
       caseId <= 0
   ) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Not Found',
           message:
               'The requested Case could not be found.'
       });
   }


   /*
    * Terminal Cases cannot receive
    * new Reports.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Create Case Report',
           message:
               'Reports cannot be created because this Case has reached a terminal status.'
       });
   }


   /*
    * Validate Report Title.
    */
   if (
       !report_title ||
       !report_title.trim()
   ) {

       return res.status(400).render(
           'cases/reports/new',
           {
               title: 'Create Case Report',
               caseRecord,
               error:
                   'Report title is required.',
               formData
           }
       );
   }


   if (
       report_title.trim().length > 255
   ) {

       return res.status(400).render(
           'cases/reports/new',
           {
               title: 'Create Case Report',
               caseRecord,
               error:
                   'Report title cannot exceed 255 characters.',
               formData
           }
       );
   }


   /*
    * Normalize Report Type.
    */
   const reportType =
       report_type &&
       report_type.trim()
           ? report_type.trim().toUpperCase()
           : 'FINAL';


   if (reportType.length > 30) {

       return res.status(400).render(
           'cases/reports/new',
           {
               title: 'Create Case Report',
               caseRecord,
               error:
                   'Report type cannot exceed 30 characters.',
               formData
           }
       );
   }


   /*
    * Prepare Report data.
    */
   const reportData = {

       reportType,

       reportTitle:
           report_title.trim(),

       executiveSummary:
           executive_summary &&
           executive_summary.trim()
               ? executive_summary.trim()
               : null,

       findings:
           findings &&
           findings.trim()
               ? findings.trim()
               : null,

       conclusion:
           conclusion &&
           conclusion.trim()
               ? conclusion.trim()
               : null,

       recommendations:
           recommendations &&
           recommendations.trim()
               ? recommendations.trim()
               : null
   };


   /*
    * Create Report.
    */
   const reportId =
       await caseReportService.createReport(
           caseId,
           req.session.user.id,
           reportData
       );


   /*
    * Retrieve the newly created Report
    * so the audit entry can include its
    * generated Report Number.
    */
   const report =
       await caseReportService.getReportById(
           reportId
       );


   /*
    * Centralized audit logging.
    */
   try {

       await auditService.log({

           actorUserId:
               req.session.user.id,

           action:
               'CREATE_CASE_REPORT',

           targetUserId:
               null,

           description:
               `Case Report ${report.report_number} created for Case ${caseRecord.case_reference}.`,

           ipAddress:
               req.ip,

           userAgent:
               req.get('user-agent')
       });

   } catch (auditError) {

       console.error(
           'Failed to record CREATE_CASE_REPORT audit:',
           auditError
       );
   }


   return res.redirect(
       `/cases/${caseId}/reports`
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Display the Edit Case Report form.
*
* Only Draft and Rejected Reports may be
* edited through the ordinary edit workflow.
  */
  async function editForm(req, res, next) {

  try {

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

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   const report =
       await caseReportService.getReportById(
           reportId
       );


   /*
    * Prevent a Report from another Case
    * being accessed through this URL.
    */
   if (
       !report ||
       Number(report.case_id) !== caseId
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Terminal Cases cannot have their
    * Reports modified.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Edit Case Report',
           message:
               'Reports cannot be edited because this Case has reached a terminal status.'
       });
   }


   /*
    * Only Draft and Rejected Reports
    * may be edited.
    */
   if (
       report.report_status_code !== 'DRAFT' &&
       report.report_status_code !== 'REJECTED'
   ) {

       return res.status(400).render('error', {
           title: 'Unable to Edit Case Report',
           message:
               'Only Draft or Rejected Case Reports can be edited.'
       });
   }


   res.render('cases/reports/edit', {
       title: 'Edit Case Report',
       caseRecord,
       report,
       error: null
   });

  } catch (error) {

   next(error);

  }
  }

/**

* Update an existing Case Report.
*
* The Case, Report Number, creator and
* approval information are preserved.
  */
  async function update(req, res, next) {

  const caseId =
  Number(req.params.id);

  const reportId =
  Number(req.params.reportId);

  const {
  report_type,
  report_title,
  executive_summary,
  findings,
  conclusion,
  recommendations
  } = req.body;

  try {

   /*
    * Validate IDs.
    */
   if (
       !Number.isInteger(caseId) ||
       caseId <= 0 ||
       !Number.isInteger(reportId) ||
       reportId <= 0
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Terminal Cases cannot have their
    * Reports modified.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Update Case Report',
           message:
               'Reports cannot be updated because this Case has reached a terminal status.'
       });
   }


   /*
    * Retrieve the Report.
    */
   const report =
       await caseReportService.getReportById(
           reportId
       );


   if (
       !report ||
       Number(report.case_id) !== caseId
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Only Draft and Rejected Reports
    * may be updated.
    */
   if (
       report.report_status_code !== 'DRAFT' &&
       report.report_status_code !== 'REJECTED'
   ) {

       return res.status(400).render('error', {
           title: 'Unable to Update Case Report',
           message:
               'Only Draft or Rejected Case Reports can be updated.'
       });
   }


   /*
    * Validate Report Title.
    */
   if (
       !report_title ||
       !report_title.trim()
   ) {

       return res.status(400).render(
           'cases/reports/edit',
           {
               title: 'Edit Case Report',
               caseRecord,
               report: {
                   ...report,
                   report_type,
                   report_title,
                   executive_summary,
                   findings,
                   conclusion,
                   recommendations
               },
               error:
                   'Report title is required.'
           }
       );
   }


   if (
       report_title.trim().length > 255
   ) {

       return res.status(400).render(
           'cases/reports/edit',
           {
               title: 'Edit Case Report',
               caseRecord,
               report: {
                   ...report,
                   report_type,
                   report_title,
                   executive_summary,
                   findings,
                   conclusion,
                   recommendations
               },
               error:
                   'Report title cannot exceed 255 characters.'
           }
       );
   }


   /*
    * Normalize Report Type.
    */
   const reportType =
       report_type &&
       report_type.trim()
           ? report_type.trim().toUpperCase()
           : 'FINAL';


   if (reportType.length > 30) {

       return res.status(400).render(
           'cases/reports/edit',
           {
               title: 'Edit Case Report',
               caseRecord,
               report: {
                   ...report,
                   report_type,
                   report_title,
                   executive_summary,
                   findings,
                   conclusion,
                   recommendations
               },
               error:
                   'Report type cannot exceed 30 characters.'
           }
       );
   }


   const reportData = {

       reportType,

       reportTitle:
           report_title.trim(),

       executiveSummary:
           executive_summary &&
           executive_summary.trim()
               ? executive_summary.trim()
               : null,

       findings:
           findings &&
           findings.trim()
               ? findings.trim()
               : null,

       conclusion:
           conclusion &&
           conclusion.trim()
               ? conclusion.trim()
               : null,

       recommendations:
           recommendations &&
           recommendations.trim()
               ? recommendations.trim()
               : null
   };


   /*
    * Update Report.
    */
   await caseReportService.updateReport(
       reportId,
       reportData
   );


   /*
    * Centralized audit logging.
    */
   try {

       await auditService.log({

           actorUserId:
               req.session.user.id,

           action:
               'UPDATE_CASE_REPORT',

           targetUserId:
               null,

           description:
               `Case Report ${report.report_number} for Case ${caseRecord.case_reference} updated.`,

           ipAddress:
               req.ip,

           userAgent:
               req.get('user-agent')
       });

   } catch (auditError) {

       console.error(
           'Failed to record UPDATE_CASE_REPORT audit:',
           auditError
       );
   }


   return res.redirect(
       `/cases/${caseId}/reports`
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Submit a Draft or Rejected Case Report.
*
* Only users with submit_case_report permission
* can reach this controller through the route.
  */
  async function submit(req, res, next) {

  try {

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

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Terminal Cases cannot have Reports
    * submitted.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Submit Case Report',
           message:
               'Reports cannot be submitted because this Case has reached a terminal status.'
       });
   }


   /*
    * Retrieve the Report.
    */
   const report =
       await caseReportService.getReportById(
           reportId
       );


   /*
    * Prevent a Report from another Case
    * being submitted through this URL.
    */
   if (
       !report ||
       Number(report.case_id) !== caseId
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Submit the Report through the service,
    * which enforces the DRAFT/REJECTED
    * transition rule.
    */
   await caseReportService.submitReport(
       reportId
   );


   /*
    * Centralized audit logging.
    */
   try {

       await auditService.log({

           actorUserId:
               req.session.user.id,

           action:
               'SUBMIT_CASE_REPORT',

           targetUserId:
               null,

           description:
               `Case Report ${report.report_number} for Case ${caseRecord.case_reference} submitted for review.`,

           ipAddress:
               req.ip,

           userAgent:
               req.get('user-agent')
       });

   } catch (auditError) {

       console.error(
           'Failed to record SUBMIT_CASE_REPORT audit:',
           auditError
       );
   }


   return res.redirect(
       `/cases/${caseId}/reports`
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Approve a submitted Case Report.
*
* Only users with approve_case_report permission
* can reach this controller through the route.
  */
  async function approve(req, res, next) {

  try {

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

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Terminal Cases cannot have Reports
    * approved.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Approve Case Report',
           message:
               'Reports cannot be approved because this Case has reached a terminal status.'
       });
   }


   const report =
       await caseReportService.getReportById(
           reportId
       );


   /*
    * Prevent a Report from another Case
    * being approved through this URL.
    */
   if (
       !report ||
       Number(report.case_id) !== caseId
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Approve through the service.
    */
   await caseReportService.approveReport(
       reportId,
       req.session.user.id
   );


   /*
    * Centralized audit logging.
    */
   try {

       await auditService.log({

           actorUserId:
               req.session.user.id,

           action:
               'APPROVE_CASE_REPORT',

           targetUserId:
               null,

           description:
               `Case Report ${report.report_number} for Case ${caseRecord.case_reference} approved.`,

           ipAddress:
               req.ip,

           userAgent:
               req.get('user-agent')
       });

   } catch (auditError) {

       console.error(
           'Failed to record APPROVE_CASE_REPORT audit:',
           auditError
       );
   }


   return res.redirect(
       `/cases/${caseId}/reports`
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Reject a submitted Case Report.
*
* Only users with reject_case_report permission
* can reach this controller through the route.
  */
  async function reject(req, res, next) {

  try {

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

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Confirm Case visibility.
    */
   const caseRecord =
       await caseService.getCaseById(
           caseId,
           req.session.user
       );


   if (!caseRecord) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Terminal Cases cannot have Reports
    * rejected.
    */
   if (caseRecord.status_is_terminal) {

       return res.status(400).render('error', {
           title: 'Unable to Reject Case Report',
           message:
               'Reports cannot be rejected because this Case has reached a terminal status.'
       });
   }


   const report =
       await caseReportService.getReportById(
           reportId
       );


   /*
    * Prevent a Report from another Case
    * being rejected through this URL.
    */
   if (
       !report ||
       Number(report.case_id) !== caseId
   ) {

       return res.status(404).render('error', {
           title: 'Case Report Not Found',
           message:
               'The requested Case Report could not be found.'
       });
   }


   /*
    * Reject through the service.
    */
   await caseReportService.rejectReport(
       reportId
   );


   /*
    * Centralized audit logging.
    */
   try {

       await auditService.log({

           actorUserId:
               req.session.user.id,

           action:
               'REJECT_CASE_REPORT',

           targetUserId:
               null,

           description:
               `Case Report ${report.report_number} for Case ${caseRecord.case_reference} rejected and returned for revision.`,

           ipAddress:
               req.ip,

           userAgent:
               req.get('user-agent')
       });

   } catch (auditError) {

       console.error(
           'Failed to record REJECT_CASE_REPORT audit:',
           auditError
       );
   }


   return res.redirect(
       `/cases/${caseId}/reports`
   );

  } catch (error) {

   next(error);

  }
  }

module.exports = {

index,
createForm,
create,
editForm,
update,
submit,
approve,
reject

};
