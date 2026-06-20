const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Users_accounts = db.users_accounts;
const Users = db.users;

const Op = db.Sequelize.Op;

exports.getLatestRegisteredUsers = async (req, res) => {
    try {
        const users_accounts = await Users_accounts.findAll({
            where: {
                id: { [Op.gte]: 299 },
            },
            attributes: ['email_or_social_media', 'contact_number', 'type', 'uuid'],
        });

        const processedUsers = await Promise.all(
            users_accounts.map(async (usersAccount) => {
                const user = await Users.findOne({
                    where: {
                        uuid: usersAccount.uuid,
                    },
                    attributes: ['first_name', 'uuid'],
                });

                switch (usersAccount.type) {
                    case 1:
                        type = 'Trader';
                        break;
                    case 2:
                        type = 'visitor looking for Large Scale';
                        break;
                    case 3:
                        type = 'visitor looking for Medium Scale';
                        break;
                    case 4:
                        type = 'visitor looking for Small Scale';
                        break;
                    default:
                        type = '';
                }

                return {
                    email_address: usersAccount.email_or_social_media,
                    contact_number: usersAccount.contact_number,
                    type: type,
                    full_name: user ? user.first_name : null, // Handling case when user is not found
                };
            }),
        );

        res.json(processedUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Some error occurred while retrieving users.' });
    }
};
