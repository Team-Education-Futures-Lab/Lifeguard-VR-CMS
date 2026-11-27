// The publication status of a course as text (specs/006 FR-018, FR-019, contracts/ui.md § Status).
// The status comes from the API: draft, published or published_changed.

/** "23 november 2026 om 14:05", in the time zone of the browser (research R13). */
export function formatPublishedAt(iso, { timeZone } = {}) {
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(iso))
}

/**
 * The title and the detail line of a status, with the texts of contracts/ui.md, and the CSS class
 * of the status dot (styles.css: grey for a draft, green for live).
 */
export function statusLabel({ status, publication }, options = {}) {
  if (status === 'published' && publication) {
    return {
      title: 'Gepubliceerd',
      detail: `Versie ${publication.versionNumber} · ${formatPublishedAt(publication.publishedAt, options)}`,
      dot: 'live',
    }
  }
  if (status === 'published_changed' && publication) {
    return {
      title: 'Gepubliceerd · wijzigingen nog niet gepubliceerd',
      detail: `Op de Quest: versie ${publication.versionNumber} · ${formatPublishedAt(publication.publishedAt, options)}`,
      dot: 'changed',
    }
  }
  // Also after unpublishing: just "Concept" (verbeterronde V6).
  return { title: 'Concept', detail: '', dot: '' }
}

/** Who sees a course in the course library, as text (specs/009 contracts/ui.md § Status en overzicht). */
export const AVAILABILITY_LABEL = {
  public: 'Algemeen beschikbaar',
  selective: 'Selectief beschikbaar',
  private: 'Alleen eigen organisatie',
}
