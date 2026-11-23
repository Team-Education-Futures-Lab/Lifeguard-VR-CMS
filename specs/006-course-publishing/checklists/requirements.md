# Specification Quality Checklist: Cursus publiceren en onpubliceren, met de basis voor versies

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- De spec noemt "de server" en ERD-tabellen (`CourseVersion`, `CourseStep`, `Answer`), zoals specs
  004 en 005: de gebruiker vraagt expliciet om een controle op de server en de constitutie verplicht
  verwijzingen naar het ERD. Geen techniek, framework of API-vorm wordt voorgeschreven.
- Constitutie, principe V: aangepast naar versie 3.0.0 (2026-11-23), zodat het FR-012 vastlegt:
  alleen een gepubliceerde cursus houdt een verwijderde video in gebruik.
- Versiemodel volgens het ERD vastgelegd in Clarifications (concept wordt vastgezet, nieuw concept
  als kopie); enige nieuwe veld: `CourseVersion.unpublishedAt`.
- FR-013 verfijnt FR-015 van feature 005: de melding voor een onbeschikbare video verschijnt alleen
  als die video niet in de live versie zit.
- Gekozen standaarden (niet gevraagd in clarify): publiceren alleen vanuit de editor;
  canvasposities tellen niet als wijziging; niet-opgeslagen wijzigingen worden bij publiceren
  eerst opgeslagen.
