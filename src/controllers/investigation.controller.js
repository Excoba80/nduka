'use strict';

const investigationService =
require('../services/investigation.service');

const auditService =
require('../services/audit.service');

/**

* Investigation Workspace.
  */
  async function index(req, res, next) {

  try {

   const investigationTypes =
       await investigationService
           .getAllActiveInvestigationTypes();

   const investigationServices =
       await investigationService
           .getInvestigationServices(
               req.session.user
           );

   return res.render(
       'investigations/index',
       {
           title: 'Investigations',
           investigationTypes,
           investigationServices
       }
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Investigation Type list.
  */
  async function indexTypes(req, res, next) {

  try {

   const investigationTypes =
       await investigationService
           .getAllInvestigationTypes();

   return res.render(
       'investigations/types/index',
       {
           title: 'Investigation Types',
           investigationTypes
       }
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Investigation Type creation form.
  */
  async function createTypeForm(req, res, next) {

  try {

   return res.render(
       'investigations/types/new',
       {
           title: 'Create Investigation Type'
       }
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Create an Investigation Type.
  */

async function createType(req, res, next) {

    try {

        const data = {
            code: req.body.code,
            name: req.body.name,
            description: req.body.description,
            servicePrice: req.body.service_price,
            displayOrder: req.body.display_order
        };

        const investigationTypeId =
            await investigationService
                .createInvestigationType(
                    data
                );

        await auditService.log({
            actorUserId:
                req.session.user.id,

            action:
                'CREATE_INVESTIGATION_TYPE',

            description:
                `Created Investigation Type #${investigationTypeId}.`,

            ipAddress:
                req.ip,

            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            '/investigations/types'
        );

    } catch (error) {

        next(error);

    }
}

/**

* Investigation Type edit form.
  */
  async function editTypeForm(req, res, next) {

  try {

   const investigationType =
       await investigationService
           .getInvestigationTypeById(
               req.params.id
           );

   if (!investigationType) {

       return res.status(404).render(
           'error',
           {
               title: 'Investigation Type Not Found',
               message: 'The requested Investigation Type was not found.'
           }
       );

   }

   return res.render(
       'investigations/types/edit',
       {
           title: 'Edit Investigation Type',
           investigationType
       }
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Update an Investigation Type.
  */

async function updateType(req, res, next) {

    try {

        const data = {
            code: req.body.code,
            name: req.body.name,
            description: req.body.description,
            servicePrice: req.body.service_price,
            displayOrder: req.body.display_order
        };

        await investigationService
            .updateInvestigationType(
                req.params.id,
                data
            );

        await auditService.log({
            actorUserId:
                req.session.user.id,

            action:
                'UPDATE_INVESTIGATION_TYPE',

            description:
                `Updated Investigation Type #${req.params.id}.`,

            ipAddress:
                req.ip,

            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            '/investigations/types'
        );

    } catch (error) {

        next(error);

    }
}

/**

* Toggle Investigation Type active state.
  */
  async function toggleType(req, res, next) {

  try {

   const result =
       await investigationService
           .toggleInvestigationType(
               req.params.id
           );

   await auditService.log({
       actorUserId: req.session.user.id,
       action: 'TOGGLE_INVESTIGATION_TYPE',
      description:
    `${result ? 'Activated' : 'Deactivated'} Investigation Type #${req.params.id}.`,
       ipAddress: req.ip,
       userAgent: req.get('user-agent')
   });

   return res.redirect(
       '/investigations/types'
   );

  } catch (error) {

   next(error);

  }
  }

/**

* Delete an unused Investigation Type.
  */
  async function deleteType(req, res, next) {

  try {

   await investigationService
       .deleteInvestigationType(
           req.params.id
       );

   await auditService.log({
       actorUserId: req.session.user.id,
       action: 'DELETE_INVESTIGATION_TYPE',
       description:
           `Deleted unused Investigation Type #${req.params.id}.`,
       ipAddress: req.ip,
       userAgent: req.get('user-agent')
   });

   return res.redirect(
       '/investigations/types'
   );

  } catch (error) {

   next(error);

  }
  }


/**
 * List fields configured for an Investigation Type.
 */
async function indexTypeFields(req, res, next) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const investigationType =
            await investigationService
                .getInvestigationTypeById(
                    investigationTypeId
                );

        if (!investigationType) {
            return res.status(404).render(
                'error',
                {
                    message:
                        'Investigation Type not found.'
                }
            );
        }

        const fields =
            await investigationService
                .getInvestigationTypeFields(
                    investigationTypeId,
                    {
                        includeInactive: true
                    }
                );

        return res.render(
            'investigations/types/fields/index',
            {
                investigationType,
                fields
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Show the Create Investigation Type Field form.
 */
async function createTypeFieldForm(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const investigationType =
            await investigationService
                .getInvestigationTypeById(
                    investigationTypeId
                );

        if (!investigationType) {
            return res.status(404).render(
                'error',
                {
                    message:
                        'Investigation Type not found.'
                }
            );
        }

        return res.render(
            'investigations/types/fields/new',
            {
                investigationType
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Create an Investigation Type Field.
 */
async function createTypeField(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const field =
            await investigationService
                .createInvestigationTypeField(
                    investigationTypeId,
                    {
                        fieldKey:
                            req.body.fieldKey,
                        fieldLabel:
                            req.body.fieldLabel,
                        fieldType:
                            req.body.fieldType,
                        placeholder:
                            req.body.placeholder,
                        helpText:
                            req.body.helpText,
                        options:
                            req.body.options,
                        isRequired:
                            req.body.isRequired,
                        isActive:
                            req.body.isActive,
                        displayOrder:
                            req.body.displayOrder
                    }
                );

        await auditService.log({
            actorUserId:
                req.session.user.id,
            action:
                'CREATE_INVESTIGATION_TYPE_FIELD',
            description:
                `Created Investigation Type Field #${field.id} for Investigation Type #${investigationTypeId}.`,
            ipAddress:
                req.ip,
            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            `/investigations/types/${investigationTypeId}/fields`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Show the Edit Investigation Type Field form.
 */
async function editTypeFieldForm(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const fieldId =
            Number(req.params.fieldId);

        const field =
            await investigationService
                .getInvestigationTypeFieldById(
                    investigationTypeId,
                    fieldId
                );

        if (!field) {
            return res.status(404).render(
                'error',
                {
                    message:
                        'Investigation Type Field not found.'
                }
            );
        }

        const investigationType =
            await investigationService
                .getInvestigationTypeById(
                    investigationTypeId
                );

        if (!investigationType) {
            return res.status(404).render(
                'error',
                {
                    message:
                        'Investigation Type not found.'
                }
            );
        }

        return res.render(
            'investigations/types/fields/edit',
            {
                investigationType,
                field
            }
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Update an Investigation Type Field.
 */
async function updateTypeField(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const fieldId =
            Number(req.params.fieldId);

        const field =
            await investigationService
                .updateInvestigationTypeField(
                    investigationTypeId,
                    fieldId,
                    {
                        fieldKey:
                            req.body.fieldKey,
                        fieldLabel:
                            req.body.fieldLabel,
                        fieldType:
                            req.body.fieldType,
                        placeholder:
                            req.body.placeholder,
                        helpText:
                            req.body.helpText,
                        options:
                            req.body.options,
                        isRequired:
                            req.body.isRequired,
                        isActive:
                            req.body.isActive,
                        displayOrder:
                            req.body.displayOrder
                    }
                );

        await auditService.log({
            actorUserId:
                req.session.user.id,
            action:
                'UPDATE_INVESTIGATION_TYPE_FIELD',
            description:
                `Updated Investigation Type Field #${field.id} for Investigation Type #${investigationTypeId}.`,
            ipAddress:
                req.ip,
            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            `/investigations/types/${investigationTypeId}/fields`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Toggle an Investigation Type Field.
 */
async function toggleTypeField(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const fieldId =
            Number(req.params.fieldId);

        const field =
            await investigationService
                .toggleInvestigationTypeField(
                    investigationTypeId,
                    fieldId
                );

        await auditService.log({
            actorUserId:
                req.session.user.id,
            action:
                'TOGGLE_INVESTIGATION_TYPE_FIELD',
            description:
                `Changed active state of Investigation Type Field #${fieldId} for Investigation Type #${investigationTypeId} to ${field.is_active ? 'active' : 'inactive'}.`,
            ipAddress:
                req.ip,
            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            `/investigations/types/${investigationTypeId}/fields`
        );

    } catch (error) {

        next(error);

    }
}


/**
 * Delete an Investigation Type Field.
 */
async function deleteTypeField(
    req,
    res,
    next
) {

    try {

        const investigationTypeId =
            Number(req.params.id);

        const fieldId =
            Number(req.params.fieldId);

        await investigationService
            .deleteInvestigationTypeField(
                investigationTypeId,
                fieldId
            );

        await auditService.log({
            actorUserId:
                req.session.user.id,
            action:
                'DELETE_INVESTIGATION_TYPE_FIELD',
            description:
                `Deleted unused Investigation Type Field #${fieldId} from Investigation Type #${investigationTypeId}.`,
            ipAddress:
                req.ip,
            userAgent:
                req.get('user-agent')
        });

        return res.redirect(
            `/investigations/types/${investigationTypeId}/fields`
        );

    } catch (error) {

        next(error);

    }
}


module.exports = {
index,
indexTypes,
createTypeForm,
createType,
editTypeForm,
updateType,
toggleType,
deleteType,
indexTypeFields,
createTypeFieldForm,
createTypeField,
editTypeFieldForm,
updateTypeField,
toggleTypeField,
deleteTypeField
};
