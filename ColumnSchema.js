/**
 * The schema for a column using LocalDatabase.
 */
class ColumnSchema {
    /**
     * @typedef ColumnSchemaOptions
     * @property {Boolean} unique If true, the column will not allow duplicate values for a single key.
     * @property {Boolean} multiEntry If true, the column will add an entry in the entry for each array element when the keyPath resolves to an array. If false, it will add one single entry containing the array.
     * @property {String} locale A string containing a specific locale code, e.g. en-US, or pl
     */

    /**
     * The options you want to initialise this column with.
     * @type {ColumnSchemaOptions}
     */
    options = {
        unique: false,
        multiEntry: false,
        locale: null
    };
    /**
     * The name of the column.
     * @type {String}
     */
    name = "";

    /**
     * Generates a column blueprint for use in the TableSchema.
     * @param {String} name The name of the column.
     * @param {ColumnSchemaOptions} [options] The options you want to initialise this column with.
     */
    constructor(name, options = this.options) {
        this.name = name;
        this.options = options;
    }
}

export default ColumnSchema;