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
     * @type {Array.<TableSchema>}
     */
    tables = [];

    /**
     * The names of all the tables in this database paired with the table schemas.
     * @type {Object.<TableSchema>}
     */
    tableMap = {};

    /**
     * The names of all the tables in this database.
     * @type {Array.<String>}
     */
    tableNames = [];

    /**
     * Generates a database blueprint for use in LocalDatabase.
     * @param {String} name 
     * @param {Array.<TableSchema>} [tables] An array of the tables you want to have in this database.
     */
    constructor(name, tables = []) {
        this.name = name;
        this.tables = tables;
        tables.map(table => { 
            this.tableMap[table.name] = table; 
            this.tableNames.push(table.name);
        });
    }
}

export default DatabaseSchema;