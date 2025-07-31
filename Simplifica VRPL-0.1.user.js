// ==UserScript==
// @name         Simplifica VRPL
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Script para Tampermonkey que facilita a vida de quem tem que preencher PO na aba VRPL no Transferegov.
// @author       Lucas Silva
// @match        *://vrpl.transferegov.sistema.gov.br/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const PREV_ID_KEY = 'vrpl_v30_prevId';
    const NEXT_ID_KEY = 'vrpl_v30_nextId';
    const SCRIPT_PREFIX = '[High-Performance]';
    const ALL_ITEMS_VALUE = '500';

    let activePollerId = null;

    console.log(`${SCRIPT_PREFIX} Simplifica VRPL ativo.`);

    /**
     * A utility function that prevents a function from being called too frequently.
     * @param {function} func The function to debounce.
     * @param {number} delay The delay in milliseconds.
     * @returns A debounced version of the function.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * The core navigation function with cancellation logic.
     */
    function findAndClickItem(itemId) {
        if (!itemId) return;
        if (activePollerId) { clearInterval(activePollerId); }

        console.log(`${SCRIPT_PREFIX} Initiating navigation to item ${itemId}...`);

        activePollerId = setInterval(() => {
            const selectElement = document.querySelector('.select-pagination');
            if (selectElement && selectElement.value === ALL_ITEMS_VALUE) {
                const allRows = document.querySelectorAll('siconv-table tbody tr');
                for (const row of allRows) {
                    const firstCell = row.querySelector('td');
                    if (firstCell && firstCell.innerText.trim() === itemId) {
                        const editLink = row.querySelector('a[alt="Editar"]');
                        if (editLink) {
                            clearInterval(activePollerId);
                            activePollerId = null;
                            editLink.click();
                        }
                        return;
                    }
                }
            }
        }, 250);
    }

    /**
     * Saves the ID of the next AND previous items when an "Edit" button is clicked.
     */
    function saveNavigationStateOnClick(event) {
        const editButton = event.target.closest('a[alt="Editar"]');
        if (!editButton) return;

        const allEditableRows = Array.from(document.querySelectorAll('siconv-table tbody tr')).filter(row => row.querySelector('a[alt="Editar"]'));
        const currentIndex = allEditableRows.findIndex(row => row.contains(editButton));

        if (currentIndex > 0) {
            sessionStorage.setItem(PREV_ID_KEY, allEditableRows[currentIndex - 1].querySelector('td')?.innerText.trim());
        } else {
            sessionStorage.removeItem(PREV_ID_KEY);
        }

        if (currentIndex < allEditableRows.length - 1) {
            sessionStorage.setItem(NEXT_ID_KEY, allEditableRows[currentIndex + 1].querySelector('td')?.innerText.trim());
        } else {
            sessionStorage.removeItem(NEXT_ID_KEY);
        }
    }

    /**
     * A persistent function that modifies the UI based on the page's context.
     */
    function handlePageChange() {
        const currentUrl = window.location.href;

        if (currentUrl.includes('/listagem')) {
            const selectElement = document.querySelector('.select-pagination');
            if (selectElement && selectElement.value !== ALL_ITEMS_VALUE) {
                let allOption = selectElement.querySelector(`option[value="${ALL_ITEMS_VALUE}"]`);
                if (!allOption) {
                    allOption = document.createElement('option');
                    allOption.value = ALL_ITEMS_VALUE;
                    allOption.text = 'Todos';
                    selectElement.appendChild(allOption);
                }
                selectElement.value = ALL_ITEMS_VALUE;
                selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        const editComponent = document.querySelector('vrpl-cadastro-po');
        if (editComponent) {
            const footer = editComponent.querySelector('footer.footer-botoes');
            if (!footer) return;

            const originalSaveButton = footer.querySelector('button.btn-primary');
            const backButton = footer.querySelector('button.botao-voltar');
            const nextItemId = sessionStorage.getItem(NEXT_ID_KEY);

            if (originalSaveButton && !document.getElementById('customSaveAndGoNext')) {
                const newSaveNextButton = originalSaveButton.cloneNode(true);
                newSaveNextButton.id = 'customSaveAndGoNext';
                newSaveNextButton.innerText = 'Salvar e ir para o próximo';
                newSaveNextButton.style.backgroundColor = '#5cb85c';
                newSaveNextButton.style.borderColor = '#4cae4c';
                newSaveNextButton.style.marginLeft = '10px';
                if (nextItemId) {
                    newSaveNextButton.addEventListener('click', (event) => {
                        event.stopPropagation();
                        originalSaveButton.click();
                        findAndClickItem(nextItemId);
                    });
                } else {
                    newSaveNextButton.disabled = true;
                    newSaveNextButton.style.opacity = '0.6';
                    newSaveNextButton.style.cursor = 'not-allowed';
                }
                originalSaveButton.parentNode.insertBefore(newSaveNextButton, originalSaveButton.nextSibling);
            }

            if (backButton) {
                backButton.style.marginLeft = '';
                if (!document.getElementById('customGoPrevNoSave')) {
                    const prevItemId = sessionStorage.getItem(PREV_ID_KEY);
                    const newPrevButton = backButton.cloneNode(true);
                    newPrevButton.id = 'customGoPrevNoSave';
                    newPrevButton.innerText = 'Item anterior';
                    newPrevButton.style.marginLeft = '10px';
                    if (prevItemId) {
                        newPrevButton.addEventListener('click', () => {
                            backButton.click();
                            findAndClickItem(prevItemId);
                        });
                    } else {
                        newPrevButton.disabled = true;
                        newPrevButton.style.opacity = '0.6';
                        newPrevButton.style.cursor = 'not-allowed';
                    }
                    backButton.parentNode.insertBefore(newPrevButton, backButton.nextSibling);
                }
                if (!document.getElementById('customGoNextNoSave')) {
                    const prevButton = document.getElementById('customGoPrevNoSave') || backButton;
                    const newNextButton = backButton.cloneNode(true);
                    newNextButton.id = 'customGoNextNoSave';
                    newNextButton.innerText = 'Próximo item';
                    newNextButton.style.marginLeft = '10px';
                    if (nextItemId) {
                        newNextButton.addEventListener('click', () => {
                            backButton.click();
                            findAndClickItem(nextItemId);
                        });
                    } else {
                        newNextButton.disabled = true;
                        newNextButton.style.opacity = '0.6';
                        newNextButton.style.cursor = 'not-allowed';
                    }
                    prevButton.parentNode.insertBefore(newNextButton, prevButton.nextSibling);
                }
            }
        }
    }

    // --- SCRIPT INITIALIZATION ---

    // Create a debounced version of our main handler function.
    const debouncedHandlePageChange = debounce(handlePageChange, 200); // 200ms delay

    // The observer now calls the debounced function, which is much more efficient.
    new MutationObserver(() => {
        debouncedHandlePageChange();
    }).observe(document.body, { childList: true, subtree: true });

    document.body.addEventListener('click', saveNavigationStateOnClick, true);

})();