// Course references (specs/010 data-model.md, research R1). A reference is an OrganisationCourse
// row with isOwner = false; it points to one published version of the original course. No new
// table: who and when come from the row itself (organisationId, addedAt), see research R2.
// Existing rows are all owner rows and keep both new columns NULL.
export async function up(knex) {
  await knex.schema.alterTable('OrganisationCourse', (table) => {
    // The chosen version of a reference (isOwner = false); always NULL for the owner.
    table.integer('courseVersionId').unsigned().nullable()
      .references('id').inTable('CourseVersion')
    // The live version for which the receiver chose to keep its current version; NULL otherwise.
    table.integer('declinedCourseVersionId').unsigned().nullable()
      .references('id').inTable('CourseVersion')
  })
}

export async function down(knex) {
  await knex.schema.alterTable('OrganisationCourse', (table) => {
    table.dropForeign(['courseVersionId'])
    table.dropForeign(['declinedCourseVersionId'])
  })
  await knex.schema.alterTable('OrganisationCourse', (table) => {
    table.dropColumn('courseVersionId')
    table.dropColumn('declinedCourseVersionId')
  })
}
