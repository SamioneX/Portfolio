/**
 * Sample usage markdown modal component
 * Provides functions to create, open, and close a modal dialog
 * with rendered markdown content and keyboard/click-outside handling.
 */

/**
 * Create and return a modal dialog element
 * @param {string} markdownHtml - Pre-rendered markdown HTML
 * @param {string} projectTitle - Project name for modal header
 * @returns {HTMLElement} - Modal element (overlay + dialog)
 */
export function renderSampleUsageModal(markdownHtml, projectTitle) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.setAttribute('data-modal-overlay', '')

  const dialog = document.createElement('div')
  dialog.className = 'modal-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', `${projectTitle} usage example`)

  const header = document.createElement('div')
  header.className = 'modal-header'
  header.innerHTML = `
    <h2 style="margin: 0; font-size: 1.25rem; font-family: var(--font-syne);">Sample Usage</h2>
    <button class="modal-close" aria-label="Close modal" title="Close (ESC to dismiss)">✕</button>
  `

  const content = document.createElement('div')
  content.className = 'modal-content'
  content.innerHTML = markdownHtml

  dialog.appendChild(header)
  dialog.appendChild(content)
  overlay.appendChild(dialog)

  // Close button handler
  const closeBtn = header.querySelector('.modal-close')
  closeBtn.addEventListener('click', () => closeModal(overlay))

  // ESC key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(overlay)
    }
  }

  // Click outside (overlay) handler
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay)
    }
  })

  // Store escape handler for cleanup later
  overlay._escapeHandler = escapeHandler

  return overlay
}

/**
 * Open modal with fade-in animation
 * @param {HTMLElement} modalElement - Modal element returned from renderSampleUsageModal
 */
export function openModal(modalElement) {
  // Add to DOM if not already there
  if (!modalElement.parentElement) {
    document.body.appendChild(modalElement)
  }

  // Trigger reflow to ensure animation plays
  modalElement.offsetHeight

  // Add visible class to trigger fade-in
  modalElement.classList.add('visible')

  // Bind ESC key listener
  if (modalElement._escapeHandler) {
    document.addEventListener('keydown', modalElement._escapeHandler)
  }

  // Prevent body scroll
  document.body.style.overflow = 'hidden'
}

/**
 * Close modal with fade-out animation
 * @param {HTMLElement} modalElement - Modal element to close
 */
export function closeModal(modalElement) {
  // Remove visible class to trigger fade-out
  modalElement.classList.remove('visible')

  // Unbind ESC key listener
  if (modalElement._escapeHandler) {
    document.removeEventListener('keydown', modalElement._escapeHandler)
  }

  // Restore body scroll after animation completes
  setTimeout(() => {
    document.body.style.overflow = ''
    // Remove from DOM
    if (modalElement.parentElement) {
      modalElement.remove()
    }
  }, 300)
}
