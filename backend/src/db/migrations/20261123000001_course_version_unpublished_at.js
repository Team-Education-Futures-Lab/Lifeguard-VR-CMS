// CourseVersion.unpublishedAt (specs/006 data-model.md, research R1). The live version of a course
// is its published version with the highest versionNumber, unless that version has been
// unpublished: then the course has no live version. Only set on a published version; set back to
// NULL when the same content is published again (FR-017).
export async function up(knex) {
  await knex.schema.alterTable('CourseVersion', (table) => {
    table.datetime('unpublishedAt').nullable()
  })
}

export async function down(knex) {
  await knex.schema.alterTable('CourseVersion', (table) => {
    table.dropColumn('unpublishedAt')
  })
}
