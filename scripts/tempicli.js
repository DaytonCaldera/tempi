// Load the variables from .env.local before anything reads them
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const inquirer = require('inquirer');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Use public DNS servers to avoid the querySrv ECONNREFUSED error
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error(chalk.red.bold('\n[FATAL] MONGODB_URI was not found in .env.local'));
    console.log(chalk.gray('Make sure the file exists and the variable name is spelled correctly.\n'));
    process.exit(1);
}

// Same as the app: without MONGODB_DB, the database named in the URI is used
const DB_NAME = process.env.MONGODB_DB;
const CLIENTS_COLLECTION = 'clients';

async function startApp() {
    console.log(chalk.cyan.bold('\n============================================='));
    console.log(chalk.white.bold('        INVENTORY MANAGEMENT SYSTEM          '));
    console.log(chalk.cyan.bold('=============================================\n'));

    const mongoClient = new MongoClient(MONGO_URI);

    try {
        console.log(chalk.gray('[INFO] Connecting to MongoDB...'));
        await mongoClient.connect();

        const db = mongoClient.db(DB_NAME);
        const clientsCollection = db.collection(CLIENTS_COLLECTION);

        // =========================================================
        // STEP 1: PICK A CLIENT (FROM THE DATABASE)
        // =========================================================
        console.log(chalk.gray('[INFO] Loading clients...'));

        const clients = await clientsCollection.find({}).toArray();

        if (clients.length === 0) {
            console.log(chalk.yellow('\n[WARNING] No clients found in the database.'));
            console.log(chalk.gray('Add data to the collection before continuing.\n'));
            await mongoClient.close();
            return;
        }

        const clientChoices = clients.map(client => ({
            name: client.nombre || client.name || 'Unnamed client',
            value: client._id.toString()
        }));

        const clientAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'clientId',
                message: 'Pick a client to continue:',
                choices: clientChoices
            }
        ]);

        const selectedClient = clients.find(c => c._id.toString() === clientAnswer.clientId);
        const clientName = selectedClient.nombre || selectedClient.name || 'Client';

        console.log(chalk.green.bold(`\n[OK] Working on: ${clientName}`));

        // =========================================================
        // STEP 2: MAIN MENU
        // =========================================================
        let exit = false;

        while (!exit) {
            console.log(chalk.gray('\n---------------------------------------------'));

            const menuAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'option',
                    message: chalk.yellow(`MAIN MENU - ${clientName.toUpperCase()} \n  Pick an action:`),
                    choices: [
                        { name: 'Import departments with inventory', value: '1' },
                        { name: 'Another system option (placeholder)', value: '2' },
                        { name: 'Switch client', value: '3' },
                        { name: chalk.red('Exit'), value: '0' }
                    ]
                }
            ]);

            switch (menuAnswer.option) {
                case '1':
                    console.log(chalk.blueBright('\n[RUNNING] -> Import departments with inventory...'));
                    const importDepartments = require('./lib/importDepartmentStock');
                    importDepartments.showFormatHelp();
                    const { filename } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'filename',
                            message: 'Name of the departments JSON file:',
                            default: '2026-01-07-departments.json',
                            validate: value => value.trim() ? true : 'Enter a file name.'
                        }
                    ]);

                    await importDepartments.importFile(filename, db, clientAnswer.clientId, false);
                    console.log(chalk.gray('... Department import finished ...'));
                    break;

                case '2':
                    console.log(chalk.blueBright('\n[RUNNING] -> Option 2...'));
                    // TODO: second option
                    break;

                case '3':
                    console.log(chalk.cyan('\n[INFO] Restarting client selection...\n'));
                    await mongoClient.close();
                    return startApp();

                case '0':
                    console.log(chalk.green.bold('\nExiting. Goodbye!\n'));
                    exit = true;
                    break;

                default:
                    console.log(chalk.red('\n[ERROR] Unknown option.'));
                    break;
            }
        }

    } catch (error) {
        console.error(chalk.red.bold('\n[UNEXPECTED ERROR]'), error);
    } finally {
        await mongoClient.close();
        console.log(chalk.gray('[INFO] MongoDB connection closed.'));
    }
}

startApp();
