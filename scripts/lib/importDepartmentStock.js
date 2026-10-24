const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { ObjectId } = require('mongodb');

/**
 * Imports departments and their stock from a JSON file in .mongodb/imports.
 * The file format uses Spanish keys ("departamento", "inventario", "item", "cantidad"); see showFormatHelp.
 */
class ImportDepartmentStock {
    constructor() {
        this.importPath = path.resolve(__dirname, '..', '..', '.mongodb', 'imports');
    }

    async importFile(fileName, db, clientIdStr, dryRun = false) {
        try {
            const clientId = new ObjectId(clientIdStr);
            const departmentsCol = db.collection('departments');
            const stockCol = db.collection('department_stock');
            const movementsCol = db.collection('stock_movements');

            const data = this.readJsonFile(fileName);

            // Counters for the final report
            let report = {
                departmentsCreated: 0,
                departmentsFound: 0,
                itemsInserted: 0,
                itemsSkipped: []
            };

            console.log(chalk.blue(`\n[PROCESSING] Importing from ${fileName}...`));

            for (const departmentData of data) {
                const departmentName = departmentData.departamento;

                // 1. Reuse the department if this client already has it
                let department = await departmentsCol.findOne({
                    name: departmentName,
                    clientId: clientId
                });

                if (!department) {
                    const newDepartment = {
                        name: departmentName,
                        description: null,
                        clientId: clientId,
                        createdAt: new Date()
                    };

                    if (!dryRun) {
                        const result = await departmentsCol.insertOne(newDepartment);
                        department = { _id: result.insertedId, name: departmentName };
                    }
                    report.departmentsCreated++;
                    console.log(chalk.green(`  + New department created: ${departmentName}`));
                } else {
                    report.departmentsFound++;
                    console.log(chalk.gray(`  = Existing department: ${departmentName}`));
                }

                // 2. Insert the department's stock, skipping products it already has
                for (const item of departmentData.inventario) {
                    const stockExists = await stockCol.findOne({
                        productName: item.item,
                        departmentId: department._id,
                        clientId: clientId
                    });

                    if (stockExists) {
                        report.itemsSkipped.push({ dept: departmentName, item: item.item });
                    } else {
                        // Basic SKU with the department prefix (e.g. LIM-1234)
                        const prefix = departmentName.substring(0, 3).toUpperCase();
                        const randomNum = Math.floor(1000 + Math.random() * 9000);
                        const sku = `${prefix}-${randomNum}`;

                        const newStock = {
                            departmentId: department._id,
                            departmentName: department.name,
                            productName: item.item,
                            sku: sku,
                            unit: "unidades", // Stored unit value, see STOCK_UNITS in lib/constants.ts
                            quantity: item.cantidad,
                            minStock: 5, // Default minimum stock
                            isDeleted: false, // The unique SKU index only covers documents with isDeleted: false
                            updatedAt: new Date(),
                            createdAt: new Date(),
                            clientId: clientId
                        };

                        if (!dryRun) {
                            const { insertedId } = await stockCol.insertOne(newStock);

                            // The starting quantity is a movement too: reports work backwards from today's quantity
                            const quantity = Number(item.cantidad) || 0;
                            if (quantity !== 0) {
                                await movementsCol.insertOne({
                                    inventoryId: insertedId,
                                    departmentId: department._id,
                                    departmentName: department.name,
                                    clientId: clientId,
                                    productName: item.item,
                                    sku: sku,
                                    type: quantity > 0 ? 'IN' : 'OUT',
                                    amount: Math.abs(quantity),
                                    previousBalance: 0,
                                    newBalance: quantity,
                                    reason: 'Inventario inicial', // MOVEMENT_REASONS.INITIAL_STOCK in lib/constants.ts
                                    user: { id: null, name: null },
                                    createdAt: newStock.createdAt
                                });
                            }
                        }
                        report.itemsInserted++;
                    }
                }
            }

            // 3. Print the final report
            this.printReport(report, dryRun);

        } catch (error) {
            console.error(chalk.red.bold('\n[FATAL] The file could not be imported:'));
            console.error(error);
        }
    }

    printReport(report, dryRun) {
        console.log(chalk.cyan.bold('\n============================================='));
        console.log(chalk.white.bold(dryRun ? '         DRY RUN REPORT                  ' : '         IMPORT REPORT                   '));
        console.log(chalk.cyan.bold('============================================='));

        console.log(chalk.white(`Departments created: `) + chalk.green.bold(report.departmentsCreated));
        console.log(chalk.white(`Departments found (existing): `) + chalk.blue.bold(report.departmentsFound));
        console.log(chalk.white(`New items inserted: `) + chalk.green.bold(report.itemsInserted));

        if (report.itemsSkipped.length > 0) {
            console.log(chalk.yellow(`\nItems skipped (already existed): `) + chalk.yellow.bold(report.itemsSkipped.length));
            console.log(chalk.gray('Skipped items:'));

            // Group the skipped items by department so the log stays short
            const groupedSkipped = report.itemsSkipped.reduce((acc, curr) => {
                if (!acc[curr.dept]) acc[curr.dept] = [];
                acc[curr.dept].push(curr.item);
                return acc;
            }, {});

            for (const [dept, items] of Object.entries(groupedSkipped)) {
                console.log(chalk.gray(`  - [${dept}]: ${items.join(', ')}`));
            }
        } else {
            console.log(chalk.green('\nNo items were skipped. All of them were inserted.'));
        }
        console.log(chalk.cyan.bold('=============================================\n'));
    }

    readJsonFile(fileName) {
        try {
            const filePath = path.join(this.importPath, fileName);
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(chalk.red(`\n[ERROR] Could not read ${fileName}. Check that it exists in the imports folder.`));
            throw error;
        }
    }

    readAllImports() {
        return fs.readdirSync(this.importPath)
            .filter((file) => file.endsWith('.json'))
            .map((file) => ({
                file,
                data: JSON.parse(fs.readFileSync(path.join(this.importPath, file), 'utf8')),
            }));
    }

    showFormatHelp() {
        console.log(chalk.cyan.bold('\n--- REQUIRED IMPORT FORMAT ---'));
        console.log(chalk.gray('The JSON file must follow this structure:'));

        console.log(`
            ${chalk.yellow('[')}
                ${chalk.yellow('{')}
                    ${chalk.blue('"departamento"')}: ${chalk.green('"Department name"')},
                    ${chalk.blue('"inventario"')}: ${chalk.yellow('[')}
                    ${chalk.yellow('{')} ${chalk.blue('"item"')}: ${chalk.green('"Item name"')}, ${chalk.blue('"cantidad"')}: ${chalk.red('10')} ${chalk.yellow('}')}
                    ${chalk.yellow(']')}
                ${chalk.yellow('}')}
            ${chalk.yellow(']')}
        `);

        console.log(chalk.white.bgBlue.bold(' IMPORTANT '));
        console.log(chalk.white('- "cantidad" must be a number.'));
        console.log(chalk.white('- For an unlimited quantity, use ') + chalk.red('0') + chalk.white('.'));
        console.log(chalk.cyan.bold('-------------------------------------------\n'));
    }
}

const importDepartments = new ImportDepartmentStock();
module.exports = importDepartments;
