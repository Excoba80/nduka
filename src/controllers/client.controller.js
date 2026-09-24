'use strict';

const clientService = require('../services/client.service');
const auditService = require('../services/audit.service');


/**
 * Display the client management page.
 */
async function index(req, res, next) {

    try {

        const clients = await clientService.getAllClients();

        res.render('clients/index', {
            title: 'Client Management',
            clients
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Display an individual client's details.
 */
async function show(req, res, next) {

    try {

        const clientId = Number(req.params.id);

        if (!Number.isInteger(clientId) || clientId <= 0) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }

        const client =
            await clientService.getClientById(clientId);

        if (!client) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }

        res.render('clients/show', {
            title: 'Client Details',
            client
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Display the create-client form.
 */
async function createForm(req, res, next) {

    try {

        const clientTypes =
            await clientService.getAllClientTypes();

        res.render('clients/new', {
            title: 'Add Client',
            error: null,
            formData: {},
            clientTypes
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Create a new client.
 */
async function create(req, res, next) {

    const {
        client_type_id,
        name,
        registration_number,
        tax_number,
        website,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        postal_code,
        remarks
    } = req.body;


    const formData = {
        client_type_id,
        name,
        registration_number,
        tax_number,
        website,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        postal_code,
        remarks
    };


    try {

        /*
         * Basic required-field validation.
         */
        if (
            !client_type_id ||
            !name
        ) {

            return res.status(400).render('clients/new', {
                title: 'Add Client',
                error: 'Client type and client name are required.',
                formData,
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Validate client type ID.
         */
        const clientTypeId = Number(client_type_id);

        if (
            !Number.isInteger(clientTypeId) ||
            clientTypeId <= 0
        ) {

            return res.status(400).render('clients/new', {
                title: 'Add Client',
                error: 'Please select a valid client type.',
                formData,
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Normalize values.
         */
        const clientData = {
            clientTypeId,

            name: name.trim(),

            registrationNumber:
                registration_number
                    ? registration_number.trim()
                    : null,

            taxNumber:
                tax_number
                    ? tax_number.trim()
                    : null,

            website:
                website
                    ? website.trim()
                    : null,

            addressLine1:
                address_line_1
                    ? address_line_1.trim()
                    : null,

            addressLine2:
                address_line_2
                    ? address_line_2.trim()
                    : null,

            city:
                city
                    ? city.trim()
                    : null,

            state:
                state
                    ? state.trim()
                    : null,

            country:
                country
                    ? country.trim()
                    : null,

            postalCode:
                postal_code
                    ? postal_code.trim()
                    : null,

            remarks:
                remarks
                    ? remarks.trim()
                    : null
        };


        /*
         * Create client.
         */
        const clientId =
            await clientService.createClient(clientData);


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'CREATE_CLIENT',
                targetUserId: null,
                description:
                    `Client account created: ${clientData.name}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Client creation already succeeded.
             * Do not turn an audit failure into an
             * apparent client creation failure.
             */
            console.error(
                'Failed to record CREATE_CLIENT audit:',
                auditError
            );
        }


        /*
         * Redirect to the newly created client.
         */
        return res.redirect(`/clients/${clientId}`);


    } catch (error) {

        /*
         * Expected business errors.
         */
        if (
            error.message ===
                'Selected client type does not exist.' ||
            error.message ===
                'Client name already exists.' ||
            error.message ===
                'Unable to generate a unique client code.'
        ) {

            return res.status(400).render('clients/new', {
                title: 'Add Client',
                error: error.message,
                formData,
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Unexpected errors.
         */
        next(error);
    }
}


/**
 * Display the edit-client form.
 */
async function editForm(req, res, next) {

    try {

        const clientId = Number(req.params.id);

        if (!Number.isInteger(clientId) || clientId <= 0) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        const client =
            await clientService.getClientById(clientId);

        if (!client) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        const clientTypes =
            await clientService.getAllClientTypes();


        res.render('clients/edit', {
            title: 'Edit Client',
            client,
            clientTypes,
            error: null
        });

    } catch (error) {

        next(error);

    }
}


/**
 * Update an existing client.
 */
async function update(req, res, next) {

    const clientId = Number(req.params.id);

    const {
        client_type_id,
        name,
        registration_number,
        tax_number,
        website,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        postal_code,
        remarks
    } = req.body;


    const formData = {
        client_type_id,
        name,
        registration_number,
        tax_number,
        website,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        postal_code,
        remarks
    };


    try {

        /*
         * Validate client ID.
         */
        if (
            !Number.isInteger(clientId) ||
            clientId <= 0
        ) {

            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found.'
            });
        }


        /*
         * Basic required-field validation.
         */
        if (
            !client_type_id ||
            !name
        ) {

            return res.status(400).render('clients/edit', {
                title: 'Edit Client',
                error:
                    'Client type and client name are required.',
                formData,
                client: {
                    id: clientId,
                    ...formData
                },
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Validate client type.
         */
        const clientTypeId = Number(client_type_id);

        if (
            !Number.isInteger(clientTypeId) ||
            clientTypeId <= 0
        ) {

            return res.status(400).render('clients/edit', {
                title: 'Edit Client',
                error: 'Please select a valid client type.',
                formData,
                client: {
                    id: clientId,
                    ...formData
                },
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Normalize values.
         */
        const clientData = {
            clientTypeId,

            name: name.trim(),

            registrationNumber:
                registration_number
                    ? registration_number.trim()
                    : null,

            taxNumber:
                tax_number
                    ? tax_number.trim()
                    : null,

            website:
                website
                    ? website.trim()
                    : null,

            addressLine1:
                address_line_1
                    ? address_line_1.trim()
                    : null,

            addressLine2:
                address_line_2
                    ? address_line_2.trim()
                    : null,

            city:
                city
                    ? city.trim()
                    : null,

            state:
                state
                    ? state.trim()
                    : null,

            country:
                country
                    ? country.trim()
                    : null,

            postalCode:
                postal_code
                    ? postal_code.trim()
                    : null,

            remarks:
                remarks
                    ? remarks.trim()
                    : null
        };


        /*
         * Update client.
         */
        await clientService.updateClient(
            clientId,
            clientData
        );


        /*
         * Centralized audit logging.
         */
        try {

            await auditService.log({
                actorUserId: req.session.user.id,
                action: 'UPDATE_CLIENT',
                targetUserId: null,
                description:
                    `Client account updated: ${clientData.name}.`,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        } catch (auditError) {

            /*
             * Client update already succeeded.
             * Do not turn an audit failure into an
             * apparent update failure.
             */
            console.error(
                'Failed to record UPDATE_CLIENT audit:',
                auditError
            );
        }


        /*
         * Redirect to the updated client.
         */
        return res.redirect(`/clients/${clientId}`);


    } catch (error) {

        /*
         * Expected business errors.
         */
        if (
            error.message === 'Client not found.' ||
            error.message ===
                'Selected client type does not exist.' ||
            error.message ===
                'Client name already exists.'
        ) {

            return res.status(400).render('clients/edit', {
                title: 'Edit Client',
                error: error.message,
                formData,
                client: {
                    id: clientId,
                    ...formData
                },
                clientTypes:
                    await clientService.getAllClientTypes()
            });
        }


        /*
         * Unexpected errors.
         */
        next(error);
    }
}


module.exports = {
    index,
    show,
    createForm,
    create,
    editForm,
    update
};