(() => {
    let e = getId('numberOfTraderMembers'),
        r = getId('numberOfVisitorMembers');
    const o = {
        users_logo_and_banners: '/api/get/users-logo-and-banners',
        number_of_visitor_members: '/api/v2/get/number-of-visitor-members',
        number_of_trader_members: '/api/v2/get/number-of-trader-members',
        logo_placeholder: `${host}/uploads/placeholder/logo-placeholder.jpg`,
    };
    Promise.all([
        fetch(o.users_logo_and_banners)
            .then((e) => {
                if (!e.ok) throw new Error('Network response was not ok');
                return e.json();
            })
            .then((e) => {
                const r =
                    e.length > 0 && e[0].logo ? `${host}/uploads/users_upload_files/${e[0].logo}` : o.logo_placeholder;
                ((userImageOutsideProfile.src = r), (isAvatarOutsideProfile.src = r));
            })
            .catch((e) => {
                (console.error('Error fetching user logo and banner:', e),
                    (userImageOutsideProfile.src = o.logo_placeholder),
                    (isAvatarOutsideProfile.src = o.logo_placeholder));
            }),
        fetch(o.number_of_trader_members)
            .then((e) => {
                if (!e.ok) throw new Error('Network response was not ok');
                return e.json();
            })
            .then((r) => {
                e.innerHTML = `Number of Trader Members: ${r.length}`;
            })
            .catch((r) => {
                (console.error('Error fetching number of trader members:', r),
                    (e.innerHTML = 'Error fetching number of trader members'));
            }),
        fetch(o.number_of_visitor_members)
            .then((e) => {
                if (!e.ok) throw new Error('Network response was not ok');
                return e.json();
            })
            .then((e) => {
                r.innerHTML = `Number of Visitor Members: ${e.length}`;
            })
            .catch((e) => {
                (console.error('Error fetching number of visitor members:', e),
                    (r.innerHTML = 'Error fetching number of visitor members'));
            }),
    ]);
})();
