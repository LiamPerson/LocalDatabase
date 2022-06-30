/**
 * The schema for a database using LocalDatabase.
 */
class DatabaseSchema {
    /**
     * The name of your database.
     * @type {String}
     */
    name = "";

    /**
     * The tables of your database.
     */
    tables = [];

    /**
     * Generates a database blueprint for use in LocalDatabase.
     * @param {String} name 
     * @param {Array.<TableSchema>} [tables] An array of the tables you want to have in this database.
     */
    constructor(name, tables = []) {
        this.name = name;
        this.tables = tables;
    }
}

export default DatabaseSchema;