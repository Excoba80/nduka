'use strict';

const clientContactService =
    require('../services/client-contact.service');

const auditService =
    require('../services/audit.service');


/**
 * Display all contacts belonging to a client.
 */
async function index(req, res, next) {

    try {

        const clientId = Number(req.params.id);

        if (!Number.isInteger(clientId) || clientId <= 0) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        const clientExists =
            await clientContactService.clientExists(clientId);

        if (!clientExists) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        const contacts =
            await clientContactService.getContactsByClientId(clientId);


        res.render('clients/contacts/index', {
            title: 'Client Contacts',
            clientId,
            contacts
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Display the add-contact form.
 */
async function createForm(req, res, next) {

    try {

        const clientId = Number(req.params.id);

        if (!Number.isInteger(clientId) || clientId <= 0) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        const clientExists =
            await clientContactService.clientExists(clientId);

        if (!clientExists) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        res.render('clients/contacts/new', {
            title: 'Add Client Contact',
            clientId,
            error: null,
            formData: {}
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Create a new client contact.
 */
async function create(req, res, next) {

    const clientId = Number(req.params.id);

    const {
        title,
        first_name,
        middle_name,
        last_name,
        position,
        phone,
        email,
        is_primary,
        remarks
    } = req.body;


    const formData = {
        title,
        first_name,
        middle_name,
        last_name,
        position,
        phone,
        email,
        is_primary,
        remarks
    };


    try {

        /*
         * Validate client ID.
         */
        if (!Number.isInteger(clientId) || clientId <= 0) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        /*
         * Confirm that the client exists.
         */
        const clientExists =
            await clientContactService.clientExists(clientId);

        if (!clientExists) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        /*
         * Validate required fields.
         */
        if (
            !first_name ||
            !first_name.trim() ||
            !last_name ||
            !last_name.trim() ||
            !phone ||
            !phone.trim()
        ) {

            return res.status(400).render(
                'clients/contacts/new',
                {
                    title: 'Add Client Contact',
                    clientId,
                    error:
                        'First name, last name, and phone are required.',
                    formData
                }
            );
        }


        /*
         * Normalize contact data.
         */
        const contactData = {

            title:
                title
                    ? title.trim()
                    : null,

            firstName:
                first_name.trim(),

            middleName:
                middle_name
                    ? middle_name.trim()
                    : null,

            lastName:
                last_name.trim(),

            position:
                position
                    ? position.trim()
                    : null,

            phone:
                phone.trim(),

            email:
                email
                    ? email.trim()
                    : null,

            isPrimary:
                is_primary === '1',

            isActive: true,

            remarks:
                remarks
                    ? remarks.trim()
                    : null
        };


        /*
         * Create contact.
         */
        const contactId =
            await clientContactService.createContact(
                clientId,
                contactData
            );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'CREATE_CLIENT_CONTACT',
                targetUserId: null,
                description:
                    `Client contact created: ${contactData.firstName} ${contactData.lastName}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record CREATE_CLIENT_CONTACT audit:',
                auditError
            );
        }


        return res.redirect(
            `/clients/${clientId}/contacts`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Display the edit-contact form.
 */
async function editForm(req, res, next) {

    try {

        const clientId = Number(req.params.id);
        const contactId = Number(req.params.contactId);


        if (
            !Number.isInteger(clientId) ||
            clientId <= 0 ||
            !Number.isInteger(contactId) ||
            contactId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        const contact =
            await clientContactService.getContactById(contactId);


        if (
            !contact ||
            Number(contact.client_id) !== clientId
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        res.render('clients/contacts/edit', {
            title: 'Edit Client Contact',
            clientId,
            contact,
            error: null
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Update an existing client contact.
 */
async function update(req, res, next) {

    const clientId = Number(req.params.id);
    const contactId = Number(req.params.contactId);

    const {
        title,
        first_name,
        middle_name,
        last_name,
        position,
        phone,
        email,
        is_primary,
        is_active,
        remarks
    } = req.body;


    const formData = {
        title,
        first_name,
        middle_name,
        last_name,
        position,
        phone,
        email,
        is_primary,
        is_active,
        remarks
    };


    try {

        /*
         * Validate IDs.
         */
        if (
            !Number.isInteger(clientId) ||
            clientId <= 0 ||
            !Number.isInteger(contactId) ||
            contactId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        /*
         * Retrieve contact.
         */
        const contact =
            await clientContactService.getContactById(contactId);


        if (
            !contact ||
            Number(contact.client_id) !== clientId
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        /*
         * Validate required fields.
         */
        if (
            !first_name ||
            !first_name.trim() ||
            !last_name ||
            !last_name.trim() ||
            !phone ||
            !phone.trim()
        ) {

            return res.status(400).render(
                'clients/contacts/edit',
                {
                    title: 'Edit Client Contact',
                    clientId,
                    contact: {
                        id: contactId,
                        client_id: clientId,
                        ...formData
                    },
                    error:
                        'First name, last name, and phone are required.'
                }
            );
        }


        /*
         * Normalize contact data.
         */
        const contactData = {

            title:
                title
                    ? title.trim()
                    : null,

            firstName:
                first_name.trim(),

            middleName:
                middle_name
                    ? middle_name.trim()
                    : null,

            lastName:
                last_name.trim(),

            position:
                position
                    ? position.trim()
                    : null,

            phone:
                phone.trim(),

            email:
                email
                    ? email.trim()
                    : null,

            isPrimary:
                is_primary === '1',

            isActive:
                is_active === '1',

            remarks:
                remarks
                    ? remarks.trim()
                    : null
        };


        /*
         * Update contact.
         */
        await clientContactService.updateContact(
            contactId,
            contactData
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'UPDATE_CLIENT_CONTACT',
                targetUserId: null,
                description:
                    `Client contact updated: ${contactData.firstName} ${contactData.lastName}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record UPDATE_CLIENT_CONTACT audit:',
                auditError
            );
        }


        return res.redirect(
            `/clients/${clientId}/contacts`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Set a client contact as the primary contact.
 */
async function setPrimary(req, res, next) {

    const clientId = Number(req.params.id);
    const contactId = Number(req.params.contactId);


    try {

        if (
            !Number.isInteger(clientId) ||
            clientId <= 0 ||
            !Number.isInteger(contactId) ||
            contactId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        await clientContactService.setPrimaryContact(
            clientId,
            contactId
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'SET_PRIMARY_CLIENT_CONTACT',
                targetUserId: null,
                description:
                    `Client contact ${contactId} was set as the primary contact for client ${clientId}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record SET_PRIMARY_CLIENT_CONTACT audit:',
                auditError
            );
        }


        return res.redirect(
            `/clients/${clientId}/contacts`
        );

    } catch (error) {

        if (
            error.message ===
            'Client contact does not belong to this client.'
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        next(error);

    }
}


/**
 * Activate or deactivate a client contact.
 */
async function setActiveStatus(req, res, next) {

    const clientId = Number(req.params.id);
    const contactId = Number(req.params.contactId);

    const isActive =
        req.body.is_active === '1';


    try {

        if (
            !Number.isInteger(clientId) ||
            clientId <= 0 ||
            !Number.isInteger(contactId) ||
            contactId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        const contact =
            await clientContactService.getContactById(contactId);


        if (
            !contact ||
            Number(contact.client_id) !== clientId
        ) {

            return res.status(404).render('error', {
                title: 'Client Contact Not Found',
                message:
                    'The requested client contact could not be found.'
            });
        }


        await clientContactService.setContactActiveStatus(
            contactId,
            isActive
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: isActive
                    ? 'ACTIVATE_CLIENT_CONTACT'
                    : 'DEACTIVATE_CLIENT_CONTACT',
                targetUserId: null,
                description:
                    `Client contact ${contact.first_name} ${contact.last_name} was ${isActive ? 'activated' : 'deactivated'}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            console.error(
                'Failed to record client contact status audit:',
                auditError
            );
        }


        return res.redirect(
            `/clients/${clientId}/contacts`
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
    setPrimary,
    setActiveStatus
};
