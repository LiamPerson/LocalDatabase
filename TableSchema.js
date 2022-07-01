/**
 * The schema for a table using LocalDatabase.
 */
class TableSchema {
    /**
     * The name of the table.
     * @type {String}
     */
    name = ""
    /**
     * The primary column of the table. 
     * In other software this may be referred to as a keypath or a primary key.
     * This must not have any duplicates!
     * @type {ColumnSchema}
     */
    keyColumn = null;
    /**
     * The columns that are not the keyColumn that reside in this table.
     * @type {Array.<ColumnSchema>}
     */
    otherColumns = [];
    /**
     * If true, the table has a key generator.
     * @type {Boolean}
     */
    autoIncrement = false;

    /**
     * Generates a table blueprint for use in DatabaseSchema.
     * @param {String} name
     * @param {ColumnSchema} keyColumn The primary column for this table. This column must not have any duplicates!
     * @param {Array.<ColumnSchema>} [otherColumns] An array of all of the other columns you want to have in this table.
     * @param {Boolean} [autoIncrement] If true, the table has a key generator.
     */
    constructor(name, keyColumn, otherColumns = [], autoIncrement = false) {
        if(!name) throw Error("Error in TableSchema. Attempting to generate a table without providing a table name.");
        if(!keyColumn) throw Error("Error in TableSchema. Attempting to generate a table without providing a key column.");
        if(otherColumns.includes(keyColumn) || new Set(otherColumns).size !== otherColumns.length) console.warn("Warning in TableSchema. You are trying to generate a table using duplicate columns. Make sure you have not included your chosen keyColumn in the \"otherColumns\" parameter.");
        this.name = name
        this.keyColumn = keyColumn;
        this.otherColumns = otherColumns;
        this.autoIncrement = autoIncrement;
    }
    
}

export default TableSchema;