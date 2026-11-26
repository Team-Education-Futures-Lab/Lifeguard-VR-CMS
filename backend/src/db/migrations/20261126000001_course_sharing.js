// Course sharing (specs/009 data-model.md, research R1). Course.visibility replaces the unused
// Course.isSharedInLibrary and takes the same values as Video.visibility. CourseAccess holds the
// chosen organisations of a 'selective' course, like VideoAccess. Existing courses become
// 'private'; no course version is touched (FR-005).
export async function up(knex) {
  await knex.schema.alterTable('Course', (table) => {
    // public = every active organisation, selective = the organisations in CourseAccess,
    // private = only the owner (not in the course library).
    table.enu('visibility', ['public', 'selective', 'private']).notNullable().defaultTo('private')
  })
  await knex.schema.alterTable('Course', (table) => {
    table.dropColumn('isSharedInLibrary')
  })
  await knex.schema.createTable('CourseAccess', (table) => {
    table.integer('courseId').unsigned().notNullable()
      .references('id').inTable('Course')
    table.integer('organisationId').unsigned().notNullable()
      .references('id').inTable('Organisation')
    table.primary(['courseId', 'organisationId'])
    // Looking up "courses shared with me" (research R2).
    table.index(['organisationId'])
  })
}

export async function down(knex) {
  await knex.schema.dropTable('CourseAccess')
  await knex.schema.alterTable('Course', (table) => {
    table.boolean('isSharedInLibrary').notNullable().defaultTo(false)
  })
  await knex.schema.alterTable('Course', (table) => {
    table.dropColumn('visibility')
  })
}
