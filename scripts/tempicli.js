// Configuramos dotenv al inicio para cargar las variables desde .env.local
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const inquirer = require('inquirer');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Forzar el uso de servidores DNS públicos para evitar el error querySrv ECONNREFUSED
dns.setServers(['8.8.8.8', '1.1.1.1']);

// Validar que la URI exista en el entorno
const URI_MONGO = process.env.MONGODB_URI;
if (!URI_MONGO) {
    console.error(chalk.red.bold('\n[ERROR CRÍTICO] No se encontró la variable MONGODB_URI en el archivo .env.local'));
    console.log(chalk.gray('Asegúrate de que el archivo existe y la variable está bien escrita.\n'));
    process.exit(1);
}

// Variables estáticas
const NOMBRE_BD = 'tempi'; // <-- Tu base de datos aquí
const COLECCION_CLIENTES = 'clients';   // <-- Tu colección de clientes aquí

async function iniciarApp() {
    console.log(chalk.cyan.bold('\n============================================='));
    console.log(chalk.white.bold('       SISTEMA DE GESTIÓN DE INVENTARIO      '));
    console.log(chalk.cyan.bold('=============================================\n'));

    const clienteMongo = new MongoClient(URI_MONGO);

    try {
        console.log(chalk.gray('[INFO] Conectando a MongoDB...'));
        await clienteMongo.connect();

        const db = clienteMongo.db(NOMBRE_BD);
        const coleccion = db.collection(COLECCION_CLIENTES);

        // =========================================================
        // PASO 1: SELECCIÓN DE CLIENTE (DESDE BASE DE DATOS)
        // =========================================================
        console.log(chalk.gray('[INFO] Cargando lista de clientes...'));

        const clientesBD = await coleccion.find({}).toArray();

        if (clientesBD.length === 0) {
            console.log(chalk.yellow('\n[ADVERTENCIA] No se encontraron clientes en la base de datos.'));
            console.log(chalk.gray('Por favor, agrega datos a la colección antes de continuar.\n'));
            await clienteMongo.close();
            return;
        }

        const opcionesClientes = clientesBD.map(cliente => ({
            name: cliente.nombre || cliente.name || 'Cliente sin nombre',
            value: cliente._id.toString()
        }));

        const respuestaCliente = await inquirer.prompt([
            {
                type: 'list',
                name: 'clienteId',
                message: 'Seleccione un cliente para continuar:',
                choices: opcionesClientes
            }
        ]);

        const clienteSeleccionado = clientesBD.find(c => c._id.toString() === respuestaCliente.clienteId);
        const nombreCliente = clienteSeleccionado.nombre || clienteSeleccionado.name || 'Cliente';

        console.log(chalk.green.bold(`\n[ÉXITO] Trabajando en el entorno de: ${nombreCliente}`));

        // =========================================================
        // PASO 2: MENÚ PRINCIPAL (CON SWITCH)
        // =========================================================
        let salir = false;

        while (!salir) {
            console.log(chalk.gray('\n---------------------------------------------'));

            const respuestaMenu = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'opcion',
                    message: chalk.yellow(`MENÚ PRINCIPAL - ${nombreCliente.toUpperCase()} \n  Seleccione una acción:`),
                    choices: [
                        { name: 'Ingreso de departamentos con inventario', value: '1' },
                        { name: 'Otra opción del sistema (Placeholder)', value: '2' },
                        { name: 'Cambiar de cliente', value: '3' },
                        { name: chalk.red('Salir'), value: '0' }
                    ]
                }
            ]);

            switch (respuestaMenu.opcion) {
                case '1':
                    console.log(chalk.blueBright('\n[EJECUTANDO] -> Ingreso de departamentos con inventario...'));
                    const importDepartments = require('./lib/importDepartmentStock');
                    importDepartments.mostrarMensajeFormato();
                    const { filename } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'filename',
                            message: 'Ingrese el nombre del archivo JSON de departamentos:',
                            default: '2026-01-07-departments.json',
                            validate: value => value.trim() ? true : 'Debes ingresar un nombre de archivo.'
                        }
                    ]);

                    // Agrega el ID del cliente como tercer parámetro
                    await importDepartments.importFile(filename, db, respuestaCliente.clienteId, false);
                    console.log(chalk.gray('... Lógica de departamentos completada ...'));
                    break;

                case '2':
                    console.log(chalk.blueBright('\n[EJECUTANDO] -> Opción 2...'));
                    // TODO: Aquí va tu segunda lógica
                    break;

                case '3':
                    console.log(chalk.cyan('\n[INFO] Reiniciando selección de cliente...\n'));
                    await clienteMongo.close();
                    return iniciarApp();

                case '0':
                    console.log(chalk.green.bold('\nSaliendo del sistema. ¡Hasta luego!\n'));
                    salir = true;
                    break;

                default:
                    console.log(chalk.red('\n[ERROR] Opción no reconocida.'));
                    break;
            }
        }

    } catch (error) {
        console.error(chalk.red.bold('\n[ERROR INESPERADO]'), error);
    } finally {
        await clienteMongo.close();
        console.log(chalk.gray('[INFO] Conexión a MongoDB cerrada de manera segura.'));
    }
}

// Ejecutar la aplicación
iniciarApp();