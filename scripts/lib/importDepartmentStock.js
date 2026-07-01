const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { ObjectId } = require('mongodb');

class ImportDepartmentStock {
    constructor() {
        this.importPath = path.resolve(__dirname, '..', '..', '.mongodb', 'imports');
    }

    async importFile(fileName, db, clientIdStr, dryRun = false) {
        try {
            // Convertir el ID del cliente de String a ObjectId
            const clientId = new ObjectId(clientIdStr);
            const departmentsCol = db.collection('departments');
            const stockCol = db.collection('department_stock');

            const data = this.readJsonFile(fileName);

            // Contadores para el reporte final
            let report = {
                departmentsCreated: 0,
                departmentsFound: 0,
                itemsInserted: 0,
                itemsSkipped: []
            };

            console.log(chalk.blue(`\n[PROCESANDO] Iniciando importación desde ${fileName}...`));

            for (const deptoData of data) {
                const deptoName = deptoData.departamento;
                
                // 1. Buscar si el departamento ya existe para este cliente
                let department = await departmentsCol.findOne({ 
                    name: deptoName, 
                    clientId: clientId 
                });

                // Si no existe, lo creamos
                if (!department) {
                    const newDept = {
                        name: deptoName,
                        description: null,
                        clientId: clientId,
                        createdAt: new Date()
                    };
                    
                    if (!dryRun) {
                        const result = await departmentsCol.insertOne(newDept);
                        department = { _id: result.insertedId, name: deptoName };
                    }
                    report.departmentsCreated++;
                    console.log(chalk.green(`  + Departamento nuevo creado: ${deptoName}`));
                } else {
                    report.departmentsFound++;
                    console.log(chalk.gray(`  = Departamento existente: ${deptoName}`));
                }

                // 2. Procesar el inventario del departamento
                for (const item of deptoData.inventario) {
                    // Buscar si el producto ya existe en este departamento y cliente
                    const stockExists = await stockCol.findOne({
                        productName: item.item,
                        departmentId: department._id,
                        clientId: clientId
                    });

                    if (stockExists) {
                        // Si existe, lo agregamos a la lista de omitidos
                        report.itemsSkipped.push({ dept: deptoName, item: item.item });
                    } else {
                        // Generar un SKU básico (Ej. LIM-1234)
                        const prefix = deptoName.substring(0, 3).toUpperCase();
                        const randomNum = Math.floor(1000 + Math.random() * 9000);
                        const sku = `${prefix}-${randomNum}`;

                        const newStock = {
                            departmentId: department._id,
                            departmentName: department.name,
                            productName: item.item,
                            sku: sku,
                            unit: "unidades",
                            quantity: item.cantidad,
                            minStock: 5, // Stock mínimo por defecto
                            updatedAt: new Date(),
                            createdAt: new Date(),
                            clientId: clientId
                        };

                        if (!dryRun) {
                            await stockCol.insertOne(newStock);
                        }
                        report.itemsInserted++;
                    }
                }
            }

            // 3. Imprimir el reporte final
            this.printReport(report, dryRun);

        } catch (error) {
            console.error(chalk.red.bold('\n[ERROR CRÍTICO] Hubo un problema al importar el archivo:'));
            console.error(error);
        }
    }

    printReport(report, dryRun) {
        console.log(chalk.cyan.bold('\n============================================='));
        console.log(chalk.white.bold(dryRun ? '    REPORTE DE SIMULACIÓN (DRY RUN)     ' : '        REPORTE DE IMPORTACIÓN           '));
        console.log(chalk.cyan.bold('============================================='));
        
        console.log(chalk.white(`Departamentos creados: `) + chalk.green.bold(report.departmentsCreated));
        console.log(chalk.white(`Departamentos encontrados (existentes): `) + chalk.blue.bold(report.departmentsFound));
        console.log(chalk.white(`Nuevos artículos insertados: `) + chalk.green.bold(report.itemsInserted));
        
        if (report.itemsSkipped.length > 0) {
            console.log(chalk.yellow(`\nArtículos omitidos (Ya existían): `) + chalk.yellow.bold(report.itemsSkipped.length));
            console.log(chalk.gray('Detalle de omitidos:'));
            
            // Agrupar los omitidos por departamento para que el log no sea enorme
            const groupedSkipped = report.itemsSkipped.reduce((acc, curr) => {
                if (!acc[curr.dept]) acc[curr.dept] = [];
                acc[curr.dept].push(curr.item);
                return acc;
            }, {});

            for (const [dept, items] of Object.entries(groupedSkipped)) {
                console.log(chalk.gray(`  - [${dept}]: ${items.join(', ')}`));
            }
        } else {
            console.log(chalk.green('\nNo se omitió ningún artículo. Todos fueron insertados.'));
        }
        console.log(chalk.cyan.bold('=============================================\n'));
    }

    readJsonFile(fileName) {
        try {
            const filePath = path.join(this.importPath, fileName);
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(chalk.red(`\n[ERROR] No se pudo leer el archivo ${fileName}. Verifica que exista en la carpeta imports.`));
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

    mostrarMensajeFormato() {
        console.log(chalk.cyan.bold('\n--- FORMATO DE IMPORTACIÓN REQUERIDO ---'));
        console.log(chalk.gray('El archivo JSON debe seguir esta estructura:'));

        console.log(`
            ${chalk.yellow('[')}
                ${chalk.yellow('{')}
                    ${chalk.blue('"departamento"')}: ${chalk.green('"Nombre del Depto"')},
                    ${chalk.blue('"inventario"')}: ${chalk.yellow('[')}
                    ${chalk.yellow('{')} ${chalk.blue('"item"')}: ${chalk.green('"Nombre objeto"')}, ${chalk.blue('"cantidad"')}: ${chalk.red('10')} ${chalk.yellow('}')}
                    ${chalk.yellow(']')}
                ${chalk.yellow('}')}
            ${chalk.yellow(']')}
        `);

        console.log(chalk.white.bgBlue.bold(' IMPORTANTE '));
        console.log(chalk.white('- Asegúrate de que "cantidad" sea un número.'));
        console.log(chalk.white('- Si la cantidad es ilimitada, usa ') + chalk.red('0') + chalk.white('.'));
        console.log(chalk.cyan.bold('-------------------------------------------\n'));
    }
}

const importDepartments = new ImportDepartmentStock();
module.exports = importDepartments;