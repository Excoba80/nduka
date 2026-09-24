'use strict';

const caseNoteService =
    require('../services/case-note.service');

const caseService =
    require('../services/case.service');

const auditService =
    require('../services/audit.service');


/**
 * Display all Notes belonging to a Case.
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
                    'The requested case could not be found.'
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
                    'The requested case could not be found.'
            });
        }


        const notes =
            await caseNoteService.getNotesByCaseId(
                caseId
            );


        res.render('cases/notes/index', {
            title: 'Case Notes',
            caseRecord,
            notes
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Display the Add Case Note form.
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
                    'The requested case could not be found.'
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


        /*
         * Terminal Cases cannot receive
         * new Notes.
         */
        if (caseRecord.status_is_terminal) {

            return res.status(400).render('error', {
                title: 'Unable to Add Case Note',
                message:
                    'Notes cannot be added because this Case has reached a terminal status.'
            });
        }


        const investigationServices =
            await caseNoteService
                .getInvestigationServicesByCaseId(
                    caseId
                );


        res.render('cases/notes/new', {
            title: 'Add Case Note',
            caseRecord,
            investigationServices,
            error: null,
            formData: {}
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Create a new Case Note.
 */
async function create(req, res, next) {

    const caseId =
        Number(req.params.id);

    const {
        case_investigation_service_id,
        note_title,
        note_content,
        is_private
    } = req.body;


    const formData = {
        case_investigation_service_id,
        note_title,
        note_content,
        is_private
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
         * Terminal Cases cannot receive
         * new Notes.
         */
        if (caseRecord.status_is_terminal) {

            return res.status(400).render('error', {
                title: 'Unable to Add Case Note',
                message:
                    'Notes cannot be added because this Case has reached a terminal status.'
            });
        }


        /*
         * Validate Note Content.
         */
        if (
            !note_content ||
            !note_content.trim()
        ) {

            return res.status(400).render(
                'cases/notes/new',
                {
                    title: 'Add Case Note',
                    caseRecord,
                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),
                    error:
                        'Note content is required.',
                    formData
                }
            );
        }


        /*
         * Validate Note Title length.
         */
        if (
            note_title &&
            note_title.trim().length > 200
        ) {

            return res.status(400).render(
                'cases/notes/new',
                {
                    title: 'Add Case Note',
                    caseRecord,
                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),
                    error:
                        'Note title cannot exceed 200 characters.',
                    formData
                }
            );
        }


        /*
         * Normalize optional investigation service.
         */
        let serviceId = null;

        if (
            case_investigation_service_id &&
            case_investigation_service_id.trim()
        ) {

            serviceId =
                Number(
                    case_investigation_service_id
                );


            if (
                !Number.isInteger(serviceId) ||
                serviceId <= 0
            ) {

                return res.status(400).render(
                    'cases/notes/new',
                    {
                        title: 'Add Case Note',
                        caseRecord,
                        investigationServices:
                            await caseNoteService
                                .getInvestigationServicesByCaseId(
                                    caseId
                                ),
                        error:
                            'Please select a valid investigation service.',
                        formData
                    }
                );
            }
        }


        const noteData = {

            caseInvestigationServiceId:
                serviceId,

            noteTitle:
                note_title
                    ? note_title.trim()
                    : null,

            noteContent:
                note_content.trim(),

            isPrivate:
                is_private === '1'
        };


        /*
         * Create Note.
         */
        const noteId =
            await caseNoteService.createNote(
                caseId,
                req.session.user.id,
                noteData
            );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({

                actorUserId:
                    req.session.user.id,

                action:
                    'CREATE_CASE_NOTE',

                targetUserId:
                    null,

                description:
                    `Case Note ${noteId} created for Case ${caseRecord.case_reference}.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CREATE_CASE_NOTE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}/notes`
        );

    } catch (error) {

        if (
            error.message ===
            'Investigation service does not belong to this Case.'
        ) {

            return res.status(400).render(
                'cases/notes/new',
                {
                    title: 'Add Case Note',

                    caseRecord:
                        await caseService.getCaseById(
                            caseId,
                            req.session.user
                        ),

                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),

                    error:
                        error.message,

                    formData
                }
            );
        }

        next(error);
    }
}


/**
 * Display the Edit Case Note form.
 */
async function editForm(req, res, next) {

    try {

        const caseId =
            Number(req.params.id);

        const noteId =
            Number(req.params.noteId);


        if (
            !Number.isInteger(caseId) ||
            caseId <= 0 ||
            !Number.isInteger(noteId) ||
            noteId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
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
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
            });
        }


        const note =
            await caseNoteService.getNoteById(
                noteId
            );


        /*
         * Prevent a Note from another Case
         * being accessed through this URL.
         */
        if (
            !note ||
            Number(note.case_id) !== caseId
        ) {

            return res.status(404).render('error', {
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
            });
        }


        /*
         * Terminal Cases cannot have their
         * Notes modified.
         */
        if (caseRecord.status_is_terminal) {

            return res.status(400).render('error', {
                title: 'Unable to Edit Case Note',
                message:
                    'Notes cannot be edited because this Case has reached a terminal status.'
            });
        }


        const investigationServices =
            await caseNoteService
                .getInvestigationServicesByCaseId(
                    caseId
                );


        res.render('cases/notes/edit', {
            title: 'Edit Case Note',
            caseRecord,
            note,
            investigationServices,
            error: null
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Update an existing Case Note.
 */
async function update(req, res, next) {

    const caseId =
        Number(req.params.id);

    const noteId =
        Number(req.params.noteId);

    const {
        case_investigation_service_id,
        note_title,
        note_content,
        is_private
    } = req.body;


    try {

        /*
         * Validate IDs.
         */
        if (
            !Number.isInteger(caseId) ||
            caseId <= 0 ||
            !Number.isInteger(noteId) ||
            noteId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
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
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
            });
        }


        /*
         * Retrieve the Note.
         */
        const note =
            await caseNoteService.getNoteById(
                noteId
            );


        if (
            !note ||
            Number(note.case_id) !== caseId
        ) {

            return res.status(404).render('error', {
                title: 'Case Note Not Found',
                message:
                    'The requested Case Note could not be found.'
            });
        }


        /*
         * Terminal Cases cannot have their
         * Notes modified.
         */
        if (caseRecord.status_is_terminal) {

            return res.status(400).render('error', {
                title: 'Unable to Update Case Note',
                message:
                    'Notes cannot be updated because this Case has reached a terminal status.'
            });
        }


        /*
         * Validate Note Content.
         */
        if (
            !note_content ||
            !note_content.trim()
        ) {

            return res.status(400).render(
                'cases/notes/edit',
                {
                    title: 'Edit Case Note',
                    caseRecord,
                    note: {
                        ...note,
                        note_title,
                        note_content,
                        is_private:
                            is_private === '1',
                        case_investigation_service_id:
                            case_investigation_service_id || null
                    },
                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),
                    error:
                        'Note content is required.'
                }
            );
        }


        /*
         * Validate Note Title length.
         */
        if (
            note_title &&
            note_title.trim().length > 200
        ) {

            return res.status(400).render(
                'cases/notes/edit',
                {
                    title: 'Edit Case Note',
                    caseRecord,
                    note: {
                        ...note,
                        note_title,
                        note_content,
                        is_private:
                            is_private === '1',
                        case_investigation_service_id:
                            case_investigation_service_id || null
                    },
                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),
                    error:
                        'Note title cannot exceed 200 characters.'
                }
            );
        }


        /*
         * Normalize optional investigation service.
         */
        let serviceId = null;

        if (
            case_investigation_service_id &&
            case_investigation_service_id.trim()
        ) {

            serviceId =
                Number(
                    case_investigation_service_id
                );


            if (
                !Number.isInteger(serviceId) ||
                serviceId <= 0
            ) {

                return res.status(400).render(
                    'cases/notes/edit',
                    {
                        title: 'Edit Case Note',
                        caseRecord,
                        note,
                        investigationServices:
                            await caseNoteService
                                .getInvestigationServicesByCaseId(
                                    caseId
                                ),
                        error:
                            'Please select a valid investigation service.'
                    }
                );
            }
        }


        const noteData = {

            caseInvestigationServiceId:
                serviceId,

            noteTitle:
                note_title
                    ? note_title.trim()
                    : null,

            noteContent:
                note_content.trim(),

            isPrivate:
                is_private === '1'
        };


        /*
         * Update Note.
         */
        await caseNoteService.updateNote(
            noteId,
            noteData
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({

                actorUserId:
                    req.session.user.id,

                action:
                    'UPDATE_CASE_NOTE',

                targetUserId:
                    null,

                description:
                    `Case Note ${noteId} for Case ${caseRecord.case_reference} updated.`,

                ipAddress:
                    req.ip,

                userAgent:
                    req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record UPDATE_CASE_NOTE audit:',
                auditError
            );
        }


        return res.redirect(
            `/cases/${caseId}/notes`
        );

    } catch (error) {

        if (
            error.message ===
            'Investigation service does not belong to this Case.'
        ) {

            const note =
                await caseNoteService.getNoteById(
                    noteId
                );

            return res.status(400).render(
                'cases/notes/edit',
                {
                    title: 'Edit Case Note',
                    caseRecord,
                    note,
                    investigationServices:
                        await caseNoteService
                            .getInvestigationServicesByCaseId(
                                caseId
                            ),
                    error:
                        error.message
                }
            );
        }

        next(error);
    }
}


module.exports = {

    index,
    createForm,
    create,
    editForm,
    update

};