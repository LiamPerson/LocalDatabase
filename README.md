# LocalDatabase
<h3>A simple embedded database designed for front-end that wraps <a href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API">IndexedDB</a>.</h3>

* [Installation](#installation)
* [Preliminary](#preliminary)
* [Creating a Database](#creating-a-database)
* [Inserting & Updating](#inserting--updating)
* [Select Queries](#select-queries)
* [Deleting](#deleting)
* [Example Usage](#example-usage)

Installation
------------

Either:

- **Modules:** Include the `LocalDatabase.js`, `ColumnSchema.js`, `TableSchema.js`, `DatabaseSchema.js` files in your project and import the LocalDatabase file: 
```js
import LocalDatabase from './LocalDatabase';
```
-  **HTML Script:** Include the LocalDatabase.all.js file and import like so:
```html
<script src="LocalDatabase.all.js"></script>
```

Preliminary
-----------

Let's cover some basics before we get into the details:

- A database is comprised of tables.
- Tables are comprised of columns.
- Rows are a collected population of columns.
- Columns are searchable to collect rows.
- Columns are updated by keyColumns.
- keyColumns are the primary identifier for rows.
- Rows can be selected and deleted by searching data in columns.

Notes
-----

A limitation of IndexedDB is that you can only perform 1 write operation at a time. Currently, IndexedDB also limits you to only having 1 instance open **per browser**! 

This means that if you implement this you won't be able to run this database in multiple tabs due to limitations of IndexedDB.

Creating a Database
-------------------

A **database** is comprised of **tables**.
**Tables** are comprised of **columns**.

```js
// Creating the "PersonsTable" table
const peopleTable = new LocalDatabase.Table("PersonsTable", 
    new LocalDatabase.Column("id", {unique: true}), // keyColumns must not allow duplicates! {unique: true} is not necessary but HIGHLY recommended!
    [ // All other columns for our people's table
        new LocalDatabase.Column("firstName"), 
        new LocalDatabase.Column("lastName"),
        new LocalDatabase.Column("age")
    ]
);
const dbSchema = new LocalDatabase.Database("MyDatabase", [peopleTable]); // Creating the database schema

// Initialise the database
await LocalDatabase.init(dbSchema);

// We can now use our database!!!

```

Inserting & Updating
--------------------

Inserting and updating are a single combined action and referred to as `add`. `add`ing an entry with the keyColumn cell's value already in the table will result in an update to the entry already in the table.

You can add a single entry into the database using:

```js
await LocalDatabase.add("PersonsTable", 
    {id: 1, firstName: "John", lastName: "Doe", age: 42}
);
// Remember, adding an entry that shares a keyColumn value with 
// another entry already in the database will simply override that entry!
```

You can add multiple entries into the database using:

```js
await LocalDatabase.multiAdd("PersonsTable", [
    {id: 4, firstName: "David", lastName: "Gray", age: 20},
    {id: 6, firstName: "John", lastName: "Gilmore", age: 69},
    {id: 5, firstName: "John", lastName: "Robson", age: 69},
    {id: 3, firstName: "Harry", lastName: "Gardener", age: 66}
]);
```

<hr>

**Note:** You can always `add` more data to entries than you have columns, but you won't be able to search those entries.

For example. I might have a table like so:

<h3>PersonsTable</h3>

<table>
    <thead>
        <tr>
            <th>id</th>
            <th>firstName</th>
            <th>lastName</th>
            <th>age</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>John</td>
            <td>Doe</td>
            <td>42</td>
        </tr>
        <tr>
            <td>2</td>
            <td>Bob</td>
            <td>Smith</td>
            <td>35</td>
        </tr>
    </tbody>
</table>

I can add more data to the *Bob Smith* entry by running an `add` like so:

```js
await LocalDatabase.add("PersonsTable", 
    {id: 2, firstName: "Bob", lastName: "Smith", age: 35, notes: "Really likes spreadsheets."}
);
```

This will result in the table now looking something like so:

<table>
    <thead>
        <tr>
            <th>id</th>
            <th>firstName</th>
            <th>lastName</th>
            <th>age</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>John</td>
            <td>Doe</td>
            <td>42</td>
        </tr>
        <tr>
            <td>2</td>
            <td>Bob</td>
            <td>Smith</td>
            <td>35</td>
            <td>Really likes spreadsheets.</td>
        </tr>
    </tbody>
</table>

Note the lack of column name in the header. This symbolises how the column you just added isn't really there in the table. It is just added on at the end when you query the row.

If you were to `select` query *Bob Smith* the result would look something like this:

```js
// The result of querying the Bob Smith row.
{ id: 2, firstName: "Bob", lastName: "Smith", age: 35, notes: "Really likes spreadsheets." }
```

Select Queries
--------------

You perform selects by passing an object matching what you're looking for.

*For example:* to select someone from the *People* table that has the firstName John, age 69, and their last name is not Gilmore:

<h3>PersonsTable</h3>

<table>
    <thead>
        <tr>
            <th>id</th>
            <th>firstName</th>
            <th>lastName</th>
            <th>age</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>John</td>
            <td>Doe</td>
            <td>42</td>
        </tr>
        <tr>
            <td>2</td>
            <td>Bob</td>
            <td>Smith</td>
            <td>35</td>
        </tr>
        <tr>
            <td>4</td>
            <td>David</td>
            <td>Gray</td>
            <td>20</td>
        </tr>
        <tr>
            <td>6</td>
            <td>John</td>
            <td>Gilmore</td>
            <td>69</td>
        </tr>
        <tr>
            <td>5</td>
            <td>John</td>
            <td>Robson</td>
            <td>69</td>
        </tr>
        <tr>
            <td>3</td>
            <td>Harry</td>
            <td>Gardener</td>
            <td>66</td>
        </tr>
    </tbody>
</table>

```js
await LocalDatabase.select("PersonsTable", {firstName: "John", age: 69, lastName: {$ne: "Gilmore"}});
```
The above line of code selects the following row:

<table>
    <tbody>
        <tr>
            <td>6</td>
            <td>John</td>
            <td>Gilmore</td>
            <td>69</td>
        </tr>
    </tbody>
</table>


Notice the `$ne` at the end of the query? Instead of searching for exact values you can search within a range or not equal to something. You can use multiple of these in the same query in the same value as well:

```js
// Select all the people aged 20 to 60
await LocalDatabase.select("PersonsTable", {age: {$lt: 60, $gte: 20}});
```

Below are all the query selectors you can use in `select`:

<h3>Query Selectors</h3>
<table>
    <thead>
        <tr>
            <th>Selector</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>$ne</td>
            <td>Not equal to (≠)</td>
        </tr>
        <tr>
            <td>$lt</td>
            <td>Less than (<)</td>
        </tr>
        <tr>
            <td>$gt</td>
            <td>Greater than (>)</td>
        </tr>
        <tr>
            <td>$lte</td>
            <td>Less than or equal to (≤)</td>
        </tr>
        <tr>
            <td>$gte</td>
            <td>Greater than or equal to (≥)</td>
        </tr>
    </tbody>
</table>


Deleting
--------

To delete entries, simply pass the table and a query just like you would in a `select` to the `delete` method.

```js
// Delete persons under the age of 18
await LocalDatabase.delete("PersonsTable", {age: {$lt: 18}});
```

Example Usage
-------------

```html
<script src="LocalDatabase.all.js"></script>
<script>
    (async() => {
        // Create the schema
        const peopleTable = new LocalDatabase.Table("People", 
            new LocalDatabase.Column("id", {unique: true}),
            [
                new LocalDatabase.Column("firstName"),
                new LocalDatabase.Column("lastName"),
                new LocalDatabase.Column("age")
            ]
        );
        const dbSchema = new LocalDatabase.Database("MyDatabase", [peopleTable]);

        // Initialise the database
        await LocalDatabase.init(dbSchema);

        // Insert some data
        await LocalDatabase.add(peopleTable.name, {id: 1, firstName: "John", lastName: "Doe", age: 42});
        await LocalDatabase.add("People", {id: 2, firstName: "Bob", lastName: "Smith", age: 35});
        await LocalDatabase.multiAdd(peopleTable.name, [
            {id: 4, firstName: "David", lastName: "Gray", age: 20},
            {id: 6, firstName: "John", lastName: "Gilmore", age: 69},
            {id: 5, firstName: "John", lastName: "Robson", age: 69},
            {id: 3, firstName: "Harry", lastName: "Gardener", age: 66}
        ]);

        // Query the database
        const allEntries = await LocalDatabase.select("People", {age: {$gt: 0}});
        console.log("All Entries", allEntries);
        const queryResult = await LocalDatabase.select("People", {firstName: "John", age: 69, lastName: {$ne: "Gilmore"}});
        console.log("Query result:", queryResult);
    })()
</script>
```