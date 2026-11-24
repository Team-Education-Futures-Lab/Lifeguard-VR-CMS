# Contract: koppelcode in het CMS

Dit zijn routes onder `/api/organisation`. Ze vragen om een organisatiesessie (cookie). Schrijvende
verzoeken vragen om de CSRF-header `X-Requested-With: cms`, net als de andere CMS-routes. Het
organisatie-id komt alleen uit de sessie (FR-019).

## GET /api/organisation/quest-link

**200** `{ "questLinkCode": "QZ7K2M9X" }`

**401** `not_authenticated` / `session_expired` · **403** `forbidden` (beheerderssessie)

## POST /api/organisation/quest-link/renew

Maakt een nieuwe koppelcode. De oude code werkt daarna niet meer, ook niet op Quests die hem
hebben bewaard; die moeten opnieuw koppelen.

**Request**: geen body.

**200** `{ "questLinkCode": "M4TQ8RVZ" }`

- De nieuwe code heeft dezelfde vorm als nu (8 tekens uit `0123456789ABCDEFGHJKMNPQRSTVWXYZ`).
- De code is uniek over alle loginCodes en questLinkCodes, ook van verwijderde organisaties.

**401** / **403**: zoals hierboven. **403** `csrf_header_missing` zonder de header.

## Frontend-teksten (NL, NFR-03)

| Plek | Tekst |
|---|---|
| Menu | "Quest koppelen" |
| Paginatitel | "Quest koppelen" |
| Uitleg | "Met deze code koppel je een Quest aan jullie organisatie. Vul hem in op de Quest. Dit is niet de code waarmee je inlogt in het CMS." |
| Knop | "Kopiëren" → na een klik "Gekopieerd" |
| Knop | "Nieuwe koppelcode maken" |
| Bevestiging titel | "Nieuwe koppelcode maken?" |
| Bevestiging tekst | "De oude code werkt daarna niet meer. Alle Quests van jullie organisatie moeten opnieuw gekoppeld worden met de nieuwe code." |
| Bevestiging knoppen | "Nieuwe code maken" / "Annuleren" |
| Na vernieuwen | "Er is een nieuwe koppelcode gemaakt." |
| Fout | "Het maken van een nieuwe code is niet gelukt. Probeer het opnieuw." |
