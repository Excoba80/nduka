'use strict';

const caseService =
    require('../services/case.service');

const auditService =
    require('../services/audit.service');


/**
 * Display the Case Management page.
 */
async function index(req, res, next) {

    try {

        const cases =
            await caseService.getAllCases(
                req.session.user
            );

        res.render('cases/index', {
            title: 'Case Management',
            cases
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Display a single Case.
 */

/**
 * Display a single Case.
 */
async function show(req, res, next) {

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
                    'The requested case could not be found.'
            });
        }


        const caseRecord =
            await caseService.getCaseById(
                caseId,
                req.session.user
            );


        if (!caseRecord) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        /*
         * Retrieve active investigators for
         * the Case assignment interface.
         */
        const investigators =
            await caseService.getInvestigators();

        const statuses =
            await caseService.getAllActiveCaseStatuses();

        const priorityLevels =
            await caseService.getAllActivePriorityLevels();

        const investigationTypes =
    await caseService.getAllActiveInvestigationTypes();

const serviceStatuses =
    await caseService.getAllActiveServiceStatuses();

const investigationServices =
    await caseService.getCaseInvestigationServices(
        caseId
    );


        res.render('cases/show', {
            title: 'Case Details',
            caseRecord,
            investigators,
            statuses,
            priorityLevels,
            investigationTypes,
            serviceStatuses,
            investigationServices
        });

    } catch (error) {

        next(error);

    }
}

/**
 * Display the create-Case form.
 */
async function createForm(req, res, next) {

    try {

        const [
            clientList,
            priorityLevels
        ] = await Promise.all([

            caseService.getClientsForCaseForm(),

            caseService.getAllActivePriorityLevels()

        ]);


        const defaultPriority =
            await caseService.getDefaultPriorityLevel();


        res.render('cases/new', {
            title: 'Create Case',
            error: null,
            formData: {},
            clients: clientList,
            priorityLevels,
            defaultPriority
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Create a new Case.
 */
async function create(req, res, next) {

    const {
        client_id,
        case_title,
        request_summary,
        priority_level_id
    } = req.body;


    const formData = {
        client_id,
        case_title,
        request_summary,
        priority_level_id
    };


    try {

        /*
         * Validate Client.
         */
        const clientId =
            Number(client_id);

        if (
            !Number.isInteger(clientId) ||
            clientId <= 0
        ) {

            return res.status(400).render(
                'cases/new',
                {
                    title: 'Create Case',
                    error:
                        'Please select a valid client.',
                    formData,
                    clients:
                        await caseService.getClientsForCaseForm(),
                    priorityLevels:
                        await caseService.getAllActivePriorityLevels(),
                    defaultPriority:
                        await caseService.getDefaultPriorityLevel()
                }
            );
        }


        /*
         * Validate Case title.
         */
        if (
            !case_title ||
            !case_title.trim()
        ) {

            return res.status(400).render(
                'cases/new',
                {
                    title: 'Create Case',
                    error:
                        'Case title is required.',
                    formData,
                    clients:
                        await caseService.getClientsForCaseForm(),
                    priorityLevels:
                        await caseService.getAllActivePriorityLevels(),
                    defaultPriority:
                        await caseService.getDefaultPriorityLevel()
                }
            );
        }


        /*
         * Validate request summary.
         */
        if (
            !request_summary ||
            !request_summary.trim()
        ) {

            return res.status(400).render(
                'cases/new',
                {
                    title: 'Create Case',
                    error:
                        'Request summary is required.',
                    formData,
                    clients:
                        await caseService.getClientsForCaseForm(),
                    priorityLevels:
                        await caseService.getAllActivePriorityLevels(),
                    defaultPriority:
                        await caseService.getDefaultPriorityLevel()
                }
            );
        }


        /*
         * Validate priority if supplied.
         */
        let priorityLevelId = null;

        if (
            priority_level_id !== undefined &&
            priority_level_id !== null &&
            priority_level_id !== ''
        ) {

            priorityLevelId =
                Number(priority_level_id);

            if (
                !Number.isInteger(priorityLevelId) ||
                priorityLevelId <= 0
            ) {

                return res.status(400).render(
                    'cases/new',
                    {
                        title: 'Create Case',
                        error:
                            'Please select a valid priority level.',
                        formData,
                        clients:
                            await caseService.getClientsForCaseForm(),
                        priorityLevels:
                            await caseService.getAllActivePriorityLevels(),
                        defaultPriority:
                            await caseService.getDefaultPriorityLevel()
                    }
                );
            }
        }


        /*
         * Normalize Case data.
         */
        const caseData = {

            clientId,

            caseTitle:
                case_title.trim(),

            requestSummary:
                request_summary.trim(),

            priorityLevelId,

            createdBy:
                req.session.user.id

        };


        /*
         * Create Case.
         */
        const caseId =
            await caseService.createCase(
                caseData
            );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'CREATE_CASE',

                targetUserId:
                    null,

                description:
                    `Case created: ${caseData.caseTitle}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Case creation succeeded.
             * Audit failure must not make the
             * successful Case creation appear to fail.
             */
            console.error(
                'Failed to record CREATE_CASE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );


    } catch (error) {

        /*
         * Expected business errors.
         */
        if (
            error.message ===
                'Selected client does not exist.' ||

            error.message ===
                'No initial case status is configured.' ||

            error.message ===
                'The configured initial case status cannot be terminal.' ||

            error.message ===
                'Selected priority level does not exist.' ||

            error.message ===
                'No default priority level is configured.' ||

            error.message ===
                'Unable to generate a unique case reference.'
        ) {

            return res.status(400).render(
                'cases/new',
                {
                    title: 'Create Case',
                    error: error.message,
                    formData,
                    clients:
                        await caseService.getClientsForCaseForm(),
                    priorityLevels:
                        await caseService.getAllActivePriorityLevels(),
                    defaultPriority:
                        await caseService.getDefaultPriorityLevel()
                }
            );
        }


        next(error);
    }
}


/**
 * Display the edit-Case form.
 */
async function editForm(req, res, next) {

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
                    'The requested case could not be found.'
            });
        }


        const caseRecord =
            await caseService.getCaseById(
                caseId,
                req.session.user
            );


        if (!caseRecord) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        const clients =
            await caseService.getClientsForCaseForm();


        res.render('cases/edit', {
            title: 'Edit Case',
            caseRecord,
            clients,
            error: null
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Update basic Case information.
 *
 * Assignment, status and priority are handled
 * by their dedicated service operations.
 */
async function update(req, res, next) {

    const caseId =
        Number(req.params.id);


    const {
        client_id,
        case_title,
        request_summary
    } = req.body;


    const formData = {
        client_id,
        case_title,
        request_summary
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
                    'The requested case could not be found.'
            });
        }


        /*
         * Confirm Case visibility.
         */
        const existingCase =
            await caseService.getCaseById(
                caseId,
                req.session.user
            );


        if (!existingCase) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        /*
         * Validate Client.
         */
        const clientId =
            Number(client_id);

        if (
            !Number.isInteger(clientId) ||
            clientId <= 0
        ) {

            return res.status(400).render(
                'cases/edit',
                {
                    title: 'Edit Case',
                    error:
                        'Please select a valid client.',
                    formData,
                    caseRecord: {
                        ...existingCase,
                        ...formData
                    },
                    clients:
                        await caseService.getClientsForCaseForm()
                }
            );
        }


        /*
         * Validate Case title.
         */
        if (
            !case_title ||
            !case_title.trim()
        ) {

            return res.status(400).render(
                'cases/edit',
                {
                    title: 'Edit Case',
                    error:
                        'Case title is required.',
                    formData,
                    caseRecord: {
                        ...existingCase,
                        ...formData
                    },
                    clients:
                        await caseService.getClientsForCaseForm()
                }
            );
        }


        /*
         * Validate request summary.
         */
        if (
            !request_summary ||
            !request_summary.trim()
        ) {

            return res.status(400).render(
                'cases/edit',
                {
                    title: 'Edit Case',
                    error:
                        'Request summary is required.',
                    formData,
                    caseRecord: {
                        ...existingCase,
                        ...formData
                    },
                    clients:
                        await caseService.getClientsForCaseForm()
                }
            );
        }


        /*
         * Normalize Case data.
         */
        const caseData = {

            clientId,

            caseTitle:
                case_title.trim(),

            requestSummary:
                request_summary.trim()

        };


        /*
         * Update Case.
         */
        await caseService.updateCase(
            caseId,
            caseData
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'UPDATE_CASE',

                targetUserId:
                    null,

                description:
                    `Case ${existingCase.case_reference} updated.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record UPDATE_CASE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );


    } catch (error) {

        if (
            error.message ===
            'Case does not exist.' ||

            error.message ===
            'Selected client does not exist.'
        ) {

            return res.status(400).render(
                'cases/edit',
                {
                    title: 'Edit Case',
                    error: error.message,
                    formData,
                    caseRecord: {
                        id: caseId,
                        ...formData
                    },
                    clients:
                        await caseService.getClientsForCaseForm()
                }
            );
        }


        next(error);
    }
}


/**
 * Assign a Case to an investigator.
 */
async function assign(req, res, next) {

    const caseId =
        Number(req.params.id);

    const investigatorId =
        Number(req.body.investigator_id);


    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        if (
            !Number.isInteger(investigatorId) ||
            investigatorId <= 0
        ) {

            return res.status(400).render('error', {
                title: 'Invalid Investigator',
                message:
                    'Please select a valid investigator.'
            });
        }


        const caseRecord =
            await caseService.getCaseForUpdate(
                caseId
            );


        if (!caseRecord) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        await caseService.assignCase(
            caseId,
            investigatorId
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'ASSIGN_CASE',

                targetUserId:
                    investigatorId,

                description:
                    `Case ${caseRecord.case_reference} assigned to investigator ID ${investigatorId}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record ASSIGN_CASE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );


    } catch (error) {

        if (
            error.message ===
                'Case does not exist.' ||

            error.message ===
                'A terminal case cannot be assigned.' ||

            error.message ===
                'Selected user is not an active investigator.'
        ) {

            return res.status(400).render('error', {
                title: 'Unable to Assign Case',
                message: error.message
            });
        }


        next(error);
    }
}


/**
 * Change Case status.
 */
async function changeStatus(req, res, next) {

    const caseId =
        Number(req.params.id);

    const statusId =
        Number(req.body.status_id);


    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        if (
            !Number.isInteger(statusId) ||
            statusId <= 0
        ) {

            return res.status(400).render('error', {
                title: 'Invalid Case Status',
                message:
                    'Please select a valid Case status.'
            });
        }


        const caseRecord =
            await caseService.getCaseForUpdate(
                caseId
            );


        if (!caseRecord) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        await caseService.changeCaseStatus(
            caseId,
            statusId
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'CHANGE_CASE_STATUS',

                targetUserId:
                    null,

                description:
                    `Case ${caseRecord.case_reference} status changed.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CHANGE_CASE_STATUS audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );


    } catch (error) {

        if (
            error.message ===
                'Case does not exist.' ||

            error.message ===
                'Current case status does not exist.' ||

            error.message ===
                'Selected case status does not exist or is inactive.' ||

            error.message ===
                'Case is already in the selected status.' ||

            error.message ===
                'A terminal case cannot change status.'
        ) {

            return res.status(400).render('error', {
                title: 'Unable to Change Case Status',
                message: error.message
            });
        }


        next(error);
    }
}


/**
 * Change Case priority.
 */
async function changePriority(req, res, next) {

    const caseId =
        Number(req.params.id);

    const priorityLevelId =
        Number(req.body.priority_level_id);


    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        if (
            !Number.isInteger(priorityLevelId) ||
            priorityLevelId <= 0
        ) {

            return res.status(400).render('error', {
                title: 'Invalid Priority',
                message:
                    'Please select a valid priority level.'
            });
        }


        const caseRecord =
            await caseService.getCaseForUpdate(
                caseId
            );


        if (!caseRecord) {

            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        await caseService.changeCasePriority(
            caseId,
            priorityLevelId
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'CHANGE_CASE_PRIORITY',

                targetUserId:
                    null,

                description:
                    `Case ${caseRecord.case_reference} priority changed.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CHANGE_CASE_PRIORITY audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );


    } catch (error) {

        if (
            error.message ===
                'Case does not exist.' ||

            error.message ===
                'A terminal case cannot change priority.' ||

            error.message ===
                'Selected priority level does not exist or is inactive.'
        ) {

            return res.status(400).render('error', {
                title: 'Unable to Change Case Priority',
                message: error.message
            });
        }


        next(error);
    }
}



/**
 * Add an Investigation Service to a Case.
 */
async function addService(req, res, next) {

    const caseId =
        Number(req.params.id);

    const investigationTypeId =
        Number(req.body.investigation_type_id);

    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }

        if (
            !Number.isInteger(investigationTypeId) ||
            investigationTypeId <= 0
        ) {
            return res.status(400).render('error', {
                title: 'Invalid Investigation Type',
                message:
                    'Please select a valid investigation type.'
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
                    'The requested case could not be found.'
            });
        }


        const serviceId =
            await caseService.addInvestigationService(
                caseId,
                investigationTypeId,
                req.session.user.id
            );


        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'CREATE_CASE_INVESTIGATION_SERVICE',

                targetUserId:
                    null,

                description:
                    `Investigation service ${serviceId} added to Case ${caseRecord.case_reference}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CREATE_CASE_INVESTIGATION_SERVICE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );

    } catch (error) {

        if (
            error.message ===
                'Case does not exist.' ||

            error.message ===
                'A terminal case cannot have investigation services added.' ||

            error.message ===
                'Selected investigation type does not exist or is inactive.' ||

            error.message ===
                'This investigation service has already been added to the Case.' ||

            error.message ===
                'No default service status is configured.' ||

            error.message ===
                'The configured default service status cannot be terminal.'
        ) {
            return res.status(400).render('error', {
                title: 'Unable to Add Investigation Service',
                message: error.message
            });
        }

        next(error);
    }
}






/**
 * Assign an Investigation Service to an investigator.
 */
async function assignService(req, res, next) {

    const caseId =
        Number(req.params.id);

    const serviceId =
        Number(req.params.serviceId);

    const investigatorId =
        Number(req.body.investigator_id);

    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }

        if (
            !Number.isInteger(serviceId) ||
            serviceId <= 0
        ) {
            return res.status(404).render('error', {
                title: 'Investigation Service Not Found',
                message:
                    'The requested investigation service could not be found.'
            });
        }

        if (
            !Number.isInteger(investigatorId) ||
            investigatorId <= 0
        ) {
            return res.status(400).render('error', {
                title: 'Invalid Investigator',
                message:
                    'Please select a valid investigator.'
            });
        }


        const caseRecord =
            await caseService.getCaseById(
                caseId,
                req.session.user
            );

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        const services =
            await caseService.getCaseInvestigationServices(
                caseId
            );

        const service =
            services.find(
                item => Number(item.id) === serviceId
            );

        if (!service) {
            return res.status(404).render('error', {
                title: 'Investigation Service Not Found',
                message:
                    'The requested investigation service could not be found.'
            });
        }


        await caseService.assignInvestigationService(
            serviceId,
            investigatorId
        );


        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'ASSIGN_CASE_INVESTIGATION_SERVICE',

                targetUserId:
                    investigatorId,

                description:
                    `Investigation service ${service.investigation_type_name} for Case ${caseRecord.case_reference} assigned to investigator ID ${investigatorId}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record ASSIGN_CASE_INVESTIGATION_SERVICE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );

    } catch (error) {

        if (
            error.message ===
                'Investigation service does not exist.' ||

            error.message ===
                'A terminal investigation service cannot be assigned.' ||

            error.message ===
                'Selected user is not an active investigator.'
        ) {
            return res.status(400).render('error', {
                title: 'Unable to Assign Investigation Service',
                message: error.message
            });
        }

        next(error);
    }
}




/**
 * Change the status of an Investigation Service.
 */
async function changeServiceStatus(req, res, next) {

    const caseId =
        Number(req.params.id);

    const serviceId =
        Number(req.params.serviceId);

    const statusId =
        Number(req.body.service_status_id);

    try {

        if (
            !Number.isInteger(caseId) ||
            caseId <= 0
        ) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }

        if (
            !Number.isInteger(serviceId) ||
            serviceId <= 0
        ) {
            return res.status(404).render('error', {
                title: 'Investigation Service Not Found',
                message:
                    'The requested investigation service could not be found.'
            });
        }

        if (
            !Number.isInteger(statusId) ||
            statusId <= 0
        ) {
            return res.status(400).render('error', {
                title: 'Invalid Service Status',
                message:
                    'Please select a valid service status.'
            });
        }


        const caseRecord =
            await caseService.getCaseById(
                caseId,
                req.session.user
            );

        if (!caseRecord) {
            return res.status(404).render('error', {
                title: 'Case Not Found',
                message:
                    'The requested case could not be found.'
            });
        }


        const services =
            await caseService.getCaseInvestigationServices(
                caseId
            );

        const service =
            services.find(
                item => Number(item.id) === serviceId
            );

        if (!service) {
            return res.status(404).render('error', {
                title: 'Investigation Service Not Found',
                message:
                    'The requested investigation service could not be found.'
            });
        }


        await caseService.changeInvestigationServiceStatus(
            serviceId,
            statusId,
            req.session.user.id
        );


        try {

            await auditService.log({
                actorUserId:
                    req.session.user.id,

                action:
                    'CHANGE_CASE_INVESTIGATION_SERVICE_STATUS',

                targetUserId:
                    null,

                description:
                    `Investigation service ${service.investigation_type_name} for Case ${caseRecord.case_reference} status changed.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CHANGE_CASE_INVESTIGATION_SERVICE_STATUS audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}`
        );

    } catch (error) {

        if (
            error.message ===
                'Investigation service does not exist.' ||

            error.message ===
                'Current service status does not exist.' ||

            error.message ===
                'Selected service status does not exist or is inactive.' ||

            error.message ===
                'Investigation service is already in the selected status.' ||

            error.message ===
                'A terminal investigation service cannot change status.'
        ) {
            return res.status(400).render('error', {
                title: 'Unable to Change Service Status',
                message: error.message
            });
        }

        next(error);
    }
}




module.exports = {

    index,
    show,
    createForm,
    create,
    editForm,
    update,
    assign,
    changeStatus,
    changePriority,
    addService,
    assignService,
    changeServiceStatus

};