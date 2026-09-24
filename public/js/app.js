'use strict';

// ======================================================
// NDUKA Global JavaScript
// ======================================================

document.addEventListener('DOMContentLoaded', () => {

    console.log('NDUKA initialized.');


    // ==================================================
    // Delete Confirmation
    // ==================================================

    const deleteForms =
        document.querySelectorAll(
            'form[data-confirm-delete]'
        );


    deleteForms.forEach((form) => {

        form.addEventListener(
            'submit',
            (event) => {

                const message =
                    form.dataset.confirmDelete;

                if (!message) {
                    return;
                }


                const confirmed =
                    window.confirm(message);


                if (!confirmed) {
                    event.preventDefault();
                }

            }
        );

    });


   // ==================================================
// Public Investigation Request Form
// ==================================================

const investigationRequestForm =
    document.querySelector(
        'form[action="/start-investigation"]'
    );


const serviceCheckboxes =
    investigationRequestForm
        ? investigationRequestForm.querySelectorAll(
            '.service-checkbox'
        )
        : [];


if (investigationRequestForm) {


    /*
     * Validation message displayed when the visitor
     * attempts to submit without selecting at least
     * one Investigation Service.
     */

    const serviceSelectionError =
    investigationRequestForm.querySelector(
        '#investigation-services-error'
    );


    /**
     * Enable or disable all fields belonging to
     * an Investigation Type.
     *
     * Disabled fields:
     * - Are not submitted.
     * - Are ignored by browser validation.
     */
    function setServiceFieldsState(
        investigationTypeId,
        isSelected
    ) {

        const fieldsContainer =
            investigationRequestForm.querySelector(
                `[data-fields-for="${investigationTypeId}"]`
            );


        if (!fieldsContainer) {
            return;
        }


        fieldsContainer.hidden =
            !isSelected;


        const fields =
            fieldsContainer.querySelectorAll(
                'input, select, textarea'
            );


        fields.forEach((field) => {

            field.disabled =
                !isSelected;

        });

    }


    /**
     * Synchronize each Investigation Type with
     * its associated dynamic fields.
     */
    function synchronizeServiceFields() {

        serviceCheckboxes.forEach(
            (checkbox) => {

                const investigationTypeId =
                    checkbox.dataset
                        .investigationTypeId;


                setServiceFieldsState(
                    investigationTypeId,
                    checkbox.checked
                );

            }
        );

    }


    /**
     * Return true when at least one Investigation
     * Service has been selected.
     */
    function hasSelectedInvestigationService() {

        return Array.from(
            serviceCheckboxes
        ).some(
            checkbox => checkbox.checked
        );

    }


    /**
     * Display the Investigation Service validation
     * message.
     */
    function showServiceSelectionError() {

        if (!serviceSelectionError) {
            return;
        }


        serviceSelectionError.hidden = false;


        serviceSelectionError.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

    }


    /**
     * Hide the Investigation Service validation
     * message.
     */
    function hideServiceSelectionError() {

        if (!serviceSelectionError) {
            return;
        }


        serviceSelectionError.hidden = true;

    }


    /**
     * Initialize the form.
     *
     * This is important when the page is rendered
     * again after a validation error and previously
     * selected services are already checked.
     */
    synchronizeServiceFields();


    /**
     * Show/hide and enable/disable dynamic fields
     * whenever an Investigation Service changes.
     */
    serviceCheckboxes.forEach(
        (checkbox) => {

            checkbox.addEventListener(
                'change',
                () => {

                    const investigationTypeId =
                        checkbox.dataset
                            .investigationTypeId;


                    setServiceFieldsState(
                        investigationTypeId,
                        checkbox.checked
                    );


                    /*
                     * As soon as the visitor selects
                     * a service, remove the validation
                     * message.
                     */
                    if (
                        hasSelectedInvestigationService()
                    ) {

                        hideServiceSelectionError();

                    }

                }
            );

        }
    );


    // ==============================================
    // Form Submission Validation + Progress State
    // ==============================================

    investigationRequestForm.addEventListener(
        'submit',
        (event) => {

            /*
             * First make sure at least one
             * Investigation Service is selected.
             */
            if (
                !hasSelectedInvestigationService()
            ) {

                event.preventDefault();

                showServiceSelectionError();

                return;

            }


                     /*
             * Allow the browser's normal HTML5
             * validation to run.
             */
            if (
                !investigationRequestForm.checkValidity()
            ) {

                event.preventDefault();

                investigationRequestForm.reportValidity();

                return;

            }


            const submitButton =
                investigationRequestForm.querySelector(
                    'button[type="submit"]'
                );


            if (!submitButton) {
                return;
            }


            /*
             * Prevent accidental double submission.
             */
            if (submitButton.disabled) {

                event.preventDefault();

                return;

            }


            /*
             * Submission is valid.
             *
             * Disable the button and display the
             * submission progress state.
             */
            submitButton.disabled =
                true;


            const buttonText =
                submitButton.querySelector(
                    '.submit-button-text'
                );

            const buttonProgress =
                submitButton.querySelector(
                    '.submit-button-progress'
                );


            if (buttonText) {

                buttonText.hidden =
                    true;

            }


            if (buttonProgress) {

                buttonProgress.hidden =
                    false;

            } else {

                /*
                 * Fallback in case the progress span
                 * is not present.
                 */
                submitButton.textContent =
                    'Submitting...';

            }

        }
    );


    // ==================================================
    // Public Investigation Recommendation
    // ==================================================

    /*
     * The recommendation helper is intentionally outside
     * the main Investigation Request form.
     *
     * It reuses the existing service checkboxes and their
     * existing change handlers rather than duplicating
     * dynamic service-particulars logic.
     */
    const recommendationHelper =
        document.querySelector(
            '.investigation-recommendation'
        );


    if (recommendationHelper) {

        const recommendationCheckboxes =
            recommendationHelper.querySelectorAll(
                '.recommendation-objective-checkbox'
            );


        const recommendationResults =
            recommendationHelper.querySelector(
                '#investigation-recommendation-results'
            );


        /*
         * Track only the Investigation Services that were
         * selected automatically by the recommendation
         * helper.
         *
         * This prevents an objective being unchecked from
         * silently removing a service the visitor selected
         * manually.
         */
        const recommendationOwnedServiceIds =
            new Set();


        /**
         * Return the Investigation Type codes associated
         * with the currently selected objectives.
         */
        function getSelectedRecommendationCodes() {

            const codes = new Set();


            recommendationCheckboxes.forEach(
                (checkbox) => {

                    if (!checkbox.checked) {
                        return;
                    }


                    const rawCodes =
                        checkbox.dataset
                            .recommendationCodes || '';


                    rawCodes
                        .split(',')
                        .map(code => code.trim())
                        .filter(Boolean)
                        .forEach(code => {
                            codes.add(code);
                        });

                }
            );


            return codes;

        }


        /**
         * Find the existing Investigation Service checkbox
         * matching a recommendation code.
         */
        function findServiceCheckboxByCode(code) {

            return Array.from(
                serviceCheckboxes
            ).find(
                (checkbox) =>
                    checkbox.dataset
                        .investigationTypeCode === code
            );

        }


        /**
         * Display the current recommendation matches.
         */
        function showInvestigationRecommendations() {

            if (!recommendationResults) {
                return;
            }


            const selectedCodes =
                getSelectedRecommendationCodes();


            if (!selectedCodes.size) {

                recommendationResults.innerHTML =
                    '<div class="alert alert-info" role="status">' +
                    'Select an area you want to verify to see matching services.' +
                    '</div>';

                recommendationResults.hidden = false;

                return;

            }


            const matchingServices = [];


            serviceCheckboxes.forEach(
                (checkbox) => {

                    const code =
                        checkbox.dataset
                            .investigationTypeCode;


                    if (
                        !code ||
                        !selectedCodes.has(code)
                    ) {
                        return;
                    }


                    const serviceWrapper =
                        checkbox.closest(
                            '.service-option-wrapper'
                        );


                    if (!serviceWrapper) {
                        return;
                    }


                    const serviceNameElement =
                        serviceWrapper.querySelector(
                            'label strong'
                        );


                    const serviceName =
                        serviceNameElement
                            ? serviceNameElement.textContent.trim()
                            : 'Investigation Service';


                    matchingServices.push({
                        name: serviceName,
                        code
                    });

                }
            );


            if (!matchingServices.length) {

                recommendationResults.innerHTML =
                    '<div class="alert alert-info" role="status">' +
                    'No matching service is currently available in the catalogue.' +
                    '</div>';

                recommendationResults.hidden = false;

                return;

            }


            const accordionItems =
                matchingServices
                    .map((service, index) => {

                        const serviceCheckbox =
                            findServiceCheckboxByCode(
                                service.code
                            );

                        const serviceId =
                            serviceCheckbox
                                ? serviceCheckbox.dataset.investigationTypeId
                                : '';

                        const itemId =
                            `recommendation-service-${serviceId || index}`;

                        return (
                            '<details class="investigation-recommendation-item"' +
                                ' id="' + itemId + '">' +

                                '<summary>' +
                                    '<span>' +
                                        service.name +
                                    '</span>' +
                                '</summary>' +

                                '<div class="recommendation-service-panel">' +
                                    '<p>' +
                                        'This service has been selected above.' +
                                        ' Its existing service particulars are available' +
                                        ' in the Investigation Services section.' +
                                    '</p>' +

                                    '<button type="button"' +
                                        ' class="recommendation-service-link"' +
                                        ' data-recommendation-service-id="' +
                                            serviceId +
                                        '">' +
                                        'View Service Particulars' +
                                    '</button>' +

                                '</div>' +

                            '</details>'
                        );

                    })
                    .join('');


            recommendationResults.innerHTML =
                '<div class="recommendation-result-content">' +
                    '<h3>Matching Investigation Services</h3>' +
                    '<p>' +
                        'The matching services have been selected above.' +
                        ' Expand a service below to go directly to its existing' +
                        ' service particulars.' +
                    '</p>' +
                    '<div class="investigation-recommendation-list">' +
                        accordionItems +
                    '</div>' +
                '</div>';


            recommendationResults.hidden = false;


            /*
             * Connect each recommendation accordion item to
             * the corresponding existing service particulars.
             */
            recommendationResults
                .querySelectorAll(
                    '.recommendation-service-link'
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            'click',
                            () => {

                                const serviceId =
                                    button.dataset
                                        .recommendationServiceId;

                                if (!serviceId) {
                                    return;
                                }


                                const serviceCheckbox =
                                    Array.from(
                                        serviceCheckboxes
                                    ).find(
                                        (checkbox) =>
                                            checkbox.dataset
                                                .investigationTypeId ===
                                            serviceId
                                    );


                                if (!serviceCheckbox) {
                                    return;
                                }


                                const serviceWrapper =
                                    serviceCheckbox.closest(
                                        '.service-option-wrapper'
                                    );


                                if (!serviceWrapper) {
                                    return;
                                }


                                const fieldsContainer =
                                    serviceWrapper.querySelector(
                                        `.investigation-type-fields[data-fields-for="${serviceId}"]`
                                    );


                                serviceWrapper.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });


                                if (fieldsContainer) {

                                    fieldsContainer.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'center'
                                    });

                                }

                            }
                        );

                    }
                );

        }


        /**
         * Apply the currently selected objectives to the
         * existing Investigation Service catalogue.
         */
        function applyRecommendationSelections() {

            const selectedCodes =
                getSelectedRecommendationCodes();


            serviceCheckboxes.forEach(
                (checkbox) => {

                    const code =
                        checkbox.dataset
                            .investigationTypeCode;


                    if (
                        !code ||
                        !selectedCodes.has(code)
                    ) {
                        return;
                    }


                    if (!checkbox.checked) {

                        checkbox.checked = true;


                        recommendationOwnedServiceIds.add(
                            checkbox.dataset
                                .investigationTypeId
                        );


                        /*
                         * Reuse the existing service-change
                         * handler so the existing dynamic
                         * particulars are opened.
                         */
                        checkbox.dispatchEvent(
                            new Event('change', {
                                bubbles: true
                            })
                        );

                    }

                }
            );


            /*
             * Remove only recommendation-owned services
             * whose objective is no longer selected.
             */
            serviceCheckboxes.forEach(
                (checkbox) => {

                    const serviceId =
                        checkbox.dataset
                            .investigationTypeId;

                    const code =
                        checkbox.dataset
                            .investigationTypeCode;


                    if (
                        !recommendationOwnedServiceIds.has(
                            serviceId
                        )
                    ) {
                        return;
                    }


                    if (selectedCodes.has(code)) {
                        return;
                    }


                    checkbox.checked = false;


                    recommendationOwnedServiceIds.delete(
                        serviceId
                    );


                    checkbox.dispatchEvent(
                        new Event('change', {
                            bubbles: true
                        })
                    );

                }
            );


            if (hasSelectedInvestigationService()) {
                hideServiceSelectionError();
            }


            showInvestigationRecommendations();

        }


        /*
         * Objective selection is itself the recommendation
         * action. No second "Use These Suggestions" click
         * is required.
         */
        recommendationCheckboxes.forEach(
            (checkbox) => {

                checkbox.addEventListener(
                    'change',
                    applyRecommendationSelections
                );

            }
        );


    }


}






    // ==================================================
    // Public Investigation Request Payment
    // ==================================================

    const investigationRequestPaymentForm =
        document.querySelector(
            'form[action="/investigation-request-payment"]'
        );


    if (investigationRequestPaymentForm) {

        investigationRequestPaymentForm.addEventListener(
            'submit',
            (event) => {

                /*
                 * Prevent accidental double submission.
                 */
                const submitButton =
                    investigationRequestPaymentForm.querySelector(
                        'button[type="submit"]'
                    );


                if (!submitButton) {
                    return;
                }


                if (submitButton.disabled) {

                    event.preventDefault();

                    return;

                }


                /*
                 * The payment intent is being submitted.
                 *
                 * Disable the button immediately and
                 * provide visible progress feedback.
                 */
                submitButton.disabled =
                    true;


                submitButton.textContent =
                    'Processing...';

            }
        );

    }


});