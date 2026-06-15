let numberOfTraderMembers = getId('numberOfTraderMembers');
let numberOfVisitorMembers = getId('numberOfVisitorMembers');

const API_URL = {
    number_of_visitor_members: `/api/v2/get/number-of-visitor-members`,
    number_of_trader_members: `/api/v2/get/number-of-trader-members`,
};

const getNumberOfTraderMembers = () => {
    return fetch(API_URL.number_of_trader_members)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then((data) => {
            numberOfTraderMembers.innerHTML = `Exhibitor Members: ${data.length}`;
        })
        .catch((error) => {
            console.error('Error fetching number of trader members:', error);
            numberOfTraderMembers.innerHTML = 'Error fetching number of trader members';
        });
};

const getNumberOfVisitorMembers = () => {
    return fetch(API_URL.number_of_visitor_members)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then((data) => {
            numberOfVisitorMembers.innerHTML = `Visitor Members: ${data.length}`;
        })
        .catch((error) => {
            console.error('Error fetching number of visitor members:', error);
            numberOfVisitorMembers.innerHTML = 'Error fetching number of visitor members';
        });
};

Promise.all([getNumberOfTraderMembers(), getNumberOfVisitorMembers()]);
