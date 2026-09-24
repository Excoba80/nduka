'use strict';

const investigationRequestService =
    require('../src/services/investigation-request.service');


/**
 * Public NDUKA Home Page.
 *
 * The homepage is intentionally independent
 * of authentication and internal case data.
 *
 * Investigation Services displayed on the page
 * come from the active Investigation Type catalogue.
 */
exports.index = async (req, res, next) => {

    try {

        const investigationTypes =
            await investigationRequestService
                .getActiveInvestigationTypes();


        return res.render(
            'public/home/index',
            {
                title:
                    'NDUKA — Marriage Intelligence & Verification',

                investigationTypes
            }
        );

    } catch (error) {

        return next(error);

    }

};