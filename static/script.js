document.addEventListener("DOMContentLoaded", () => {
    // --- Element Cache ---
    const elements = {
        // Forms
        addUserForm: document.getElementById("add-user-form"),
        addMailboxForm: document.getElementById("add-mailbox-form"),
        // Errors & Messages
        addUserError: document.getElementById("add-user-error"),
        addMailboxError: document.getElementById("add-mailbox-error"),
        mailboxCheckMessage: document.getElementById("mailbox-check-message"),
        mailboxCheckMessageUser: document.getElementById("mailbox-check-message-user"),
        usernameCheckMessage: document.getElementById("username-check-message"),
        // Inputs
        newUsernameInput: document.getElementById("new-username"),
        newDisplayNameInput: document.getElementById("new-displayname"),
        createMailboxCheckbox: document.getElementById("create-mailbox-checkbox"),
        mailboxNameWrapper: document.getElementById("mailbox-name-wrapper"),
        newMailboxNameUserInput: document.getElementById("new-mailbox-name-user"),
        newMailboxDomainUserSelect: document.getElementById("new-mailbox-domain-user"),
        newMailboxNameInput: document.getElementById("new-mailbox-name"),
        newMailboxDomainSelect: document.getElementById("new-mailbox-domain"),
        newMailboxOwnerSelect: document.getElementById("new-mailbox-owner"),
        // Tables
        userListBody: document.getElementById("user-list")?.querySelector("tbody"),
        mailboxListBody: document.getElementById("mailbox-list")?.querySelector("tbody"),
        // Buttons
        createUserBtn: document.getElementById("create-user-btn"),
        // Modals & Buttons
        addNewBtn: document.getElementById("add-new-btn"),
        creationModal: document.getElementById("creation-modal"),
        closeCreationModal: document.getElementById("close-creation-modal"),
        logModal: document.getElementById("log-modal"),
        closeLogModal: document.getElementById("close-log-modal"),
        logContent: document.getElementById("log-content"),
        resetPasswordModal: document.getElementById("reset-password-modal"),
        closeResetModal: document.getElementById("close-reset-modal"),
        dashboardTitle: document.getElementById("dashboard-title"),
        copyright: document.getElementById("copyright"),
        // Modal Tabs
        tabsContainer: document.querySelector(".tabs"),
        tabLinks: document.querySelectorAll(".tab-link"),
        tabContents: document.querySelectorAll(".tab-content"),
    };

    // --- API Helper ---
    const api = async (path, options = {}) => {
        const defaultHeaders = { "Content-Type": "application/json" };
        const finalOptions = { ...options, headers: { ...defaultHeaders, ...options.headers } };
        const response = await fetch(`/api${path}`, finalOptions);
        if (response.status === 401) {
            document.body.innerHTML = "<h1>Authentication Required</h1><p>Refresh to try again.</p>";
            throw new Error("Unauthorized");
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "An unknown error occurred" }));
            throw new Error(errorData.error || errorData.message);
        }
        if (response.status === 204 || response.headers.get("content-length") === "0") return null;
        return response.json();
    };

    // --- Data Fetching and Rendering ---
    const fetchAndDisplayData = async () => {
        try {
            console.log("Fetching initial data from API...");
            const [users, mailboxes, config] = await Promise.all([
                api("/users"),
                api("/mailboxes"),
                api("/config")
            ]);

            console.log("Data received:", { users, mailboxes, config });

            if (!users || !mailboxes || !config) {
                throw new Error("One or more API endpoints returned null or empty data.");
            }

            console.log("Rendering data...");
            renderUsers(users);
            renderMailboxes(mailboxes, users);
            renderSelects(config.domains, users);
            elements.dashboardTitle.textContent = `${config.brandName} User Management`;
            console.log("Data rendering complete.");

        } catch (error) {
            console.error("Failed to fetch or render initial data:", error);
            alert(`A critical error occurred: ${error.message}\n\nPlease check the browser's developer console for more details.`);
        }
    };

    const renderUsers = (users) => {
        if (!elements.userListBody) {
            throw new Error("Fatal Error: User list table body not found in the DOM.");
        }
        console.log("Rendering users. Data:", users);
        if (!Array.isArray(users)) {
            throw new Error(`Data for users is not an array. Type: ${typeof users}`);
        }

        elements.userListBody.innerHTML = "";
        users.forEach(user => {
            const row = document.createElement("tr");
            const isActive = user.active !== false;
            row.style.opacity = isActive ? "1" : "0.5";
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.displayName}</td>
                <td>${user.email}</td>
                <td>${isActive ? 'Active' : 'Disabled'}</td>
                <td>
                    <button class="secondary reset-password-btn" data-id="${user.id}">Reset</button>
                    <button class="${isActive ? 'warning' : 'secondary'} disable-btn" data-id="${user.id}" data-active="${isActive}">${isActive ? 'Disable' : 'Enable'}</button>
                    <button class="danger delete-btn" data-id="${user.id}" data-username="${user.username}">Delete</button>
                </td>
            `;
            elements.userListBody.appendChild(row);
        });
    };

    const renderMailboxes = (mailboxes, users) => {
        if (!elements.mailboxListBody) {
            throw new Error("Fatal Error: Mailbox list table body not found in the DOM.");
        }
        console.log("Rendering mailboxes. Data:", mailboxes);
        if (!Array.isArray(mailboxes)) {
            throw new Error(`Data for mailboxes is not an array. Type: ${typeof mailboxes}`);
        }
        if (!Array.isArray(users)) {
            // This check is important for creating the userMap
            throw new Error(`Data for users in renderMailboxes is not an array. Type: ${typeof users}`);
        }

        elements.mailboxListBody.innerHTML = "";
        const userMap = new Map(users.map(u => [u.id, u.username]));
        mailboxes.forEach(mbx => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${mbx.name}@${mbx.domain}</td>
                <td>${userMap.get(mbx.ownerId) || 'N/A'}</td>
                <td>
                    <button class="danger delete-mailbox-btn" data-name="${mbx.name}" data-domain="${mbx.domain}">Delete</button>
                </td>
            `;
            elements.mailboxListBody.appendChild(row);
        });
    };

    const renderSelects = (domains, users) => {
        const domainOptions = domains.map(domain => `<option value="${domain}">${domain}</option>`).join('');
        elements.newMailboxDomainSelect.innerHTML = domainOptions;
        elements.newMailboxDomainUserSelect.innerHTML = domainOptions;

        elements.newMailboxOwnerSelect.innerHTML = `<option value="" disabled selected>Select owner</option>`;
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user.id;
            option.textContent = user.username;
            elements.newMailboxOwnerSelect.appendChild(option);
        });
    };

    // --- Input Validation ---
    const validateInput = (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    elements.newUsernameInput.addEventListener("input", validateInput);
    elements.newMailboxNameUserInput.addEventListener("input", validateInput);
    elements.newMailboxNameInput.addEventListener("input", validateInput);

    const checkMailboxExists = async (name, domain) => {
        if (!name || !domain) return false;
        const res = await api(`/mailboxes/${domain}/${name}/exists`);
        return res.exists;
    };

    const checkUsernameExists = async (username) => {
        if (!username) return false;
        const res = await api(`/users/${username}/exists`);
        return res.exists;
    };

    let isUsernameAvailable = false;
    let isMailboxAvailable = false;

    const updateUserButtonState = () => {
        const createMailbox = elements.createMailboxCheckbox.checked;
        if (createMailbox) {
            elements.createUserBtn.disabled = !isUsernameAvailable || !isMailboxAvailable;
        } else {
            elements.createUserBtn.disabled = !isUsernameAvailable;
        }
    };

    const handleUsernameCheck = async () => {
        const username = elements.newUsernameInput.value;
        const messageEl = elements.usernameCheckMessage;
        
        messageEl.textContent = "";
        messageEl.className = 'info-message';
        elements.newUsernameInput.classList.remove('error', 'success');
        isUsernameAvailable = false;

        if (username) {
            try {
                messageEl.textContent = "Checking...";
                if (await checkUsernameExists(username)) {
                    messageEl.textContent = "Username is already taken.";
                    messageEl.className = 'error-message';
                    elements.newUsernameInput.classList.add('error');
                } else {
                    messageEl.textContent = "Username is available.";
                    messageEl.className = 'success-message';
                    elements.newUsernameInput.classList.add('success');
                    isUsernameAvailable = true;
                }
            } catch (error) {
                messageEl.textContent = "Error checking username.";
                messageEl.className = 'error-message';
                elements.newUsernameInput.classList.add('error');
            }
        }
        updateUserButtonState();
    };

    const handleMailboxCheck = async (nameInput, domainSelect, messageEl) => {
        const name = nameInput.value;
        const domain = domainSelect.value;
        
        messageEl.textContent = "";
        messageEl.className = 'info-message';
        nameInput.classList.remove('error', 'success');
        isMailboxAvailable = false;

        if (name && domain) {
            try {
                messageEl.textContent = "Checking...";
                if (await checkMailboxExists(name, domain)) {
                    messageEl.textContent = "Mailbox already exists.";
                    messageEl.className = 'error-message';
                    nameInput.classList.add('error');
                } else {
                    messageEl.textContent = "Mailbox name is available.";
                    messageEl.className = 'success-message';
                    nameInput.classList.add('success');
                    isMailboxAvailable = true;
                }
            } catch (error) {
                messageEl.textContent = "Error checking availability.";
                messageEl.className = 'error-message';
                nameInput.classList.add('error');
            }
        }
        updateUserButtonState();
    };
    
    let usernameDebounceTimer, userMailboxDebounceTimer, newMailboxDebounceTimer;

    elements.newUsernameInput.addEventListener("input", () => {
        clearTimeout(usernameDebounceTimer);
        usernameDebounceTimer = setTimeout(handleUsernameCheck, 500);
    });

    elements.newMailboxNameUserInput.addEventListener("input", () => {
        clearTimeout(userMailboxDebounceTimer);
        userMailboxDebounceTimer = setTimeout(() => handleMailboxCheck(
            elements.newMailboxNameUserInput,
            elements.newMailboxDomainUserSelect,
            elements.mailboxCheckMessageUser
        ), 500);
    });
    elements.newMailboxDomainUserSelect.addEventListener("change", () => {
        clearTimeout(userMailboxDebounceTimer);
        userMailboxDebounceTimer = setTimeout(() => handleMailboxCheck(
            elements.newMailboxNameUserInput,
            elements.newMailboxDomainUserSelect,
            elements.mailboxCheckMessageUser
        ), 500);
    });

    elements.newMailboxNameInput.addEventListener("input", () => {
        clearTimeout(newMailboxDebounceTimer);
        newMailboxDebounceTimer = setTimeout(() => handleMailboxCheck(
            elements.newMailboxNameInput,
            elements.newMailboxDomainSelect,
            elements.mailboxCheckMessage
        ), 500);
    });
    elements.newMailboxDomainSelect.addEventListener("change", () => {
        clearTimeout(newMailboxDebounceTimer);
        newMailboxDebounceTimer = setTimeout(() => handleMailboxCheck(
            elements.newMailboxNameInput,
            elements.newMailboxDomainSelect,
            elements.mailboxCheckMessage
        ), 500);
    });

    elements.createMailboxCheckbox.addEventListener("change", updateUserButtonState);

    // --- Event Listeners ---
    elements.addUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        elements.addUserError.textContent = "";
        const username = elements.newUsernameInput.value;
        const displayName = elements.newDisplayNameInput.value;
        const password = document.getElementById('new-password-user').value;
        const confirmPassword = document.getElementById('confirm-password-user').value;
        const fallbackEmail = document.getElementById('fallback-email').value;
        const createMailbox = elements.createMailboxCheckbox.checked;
        const mailboxName = elements.newMailboxNameUserInput.value || username;
        const domain = elements.newMailboxDomainUserSelect.value;

        if (password !== confirmPassword) {
            elements.addUserError.textContent = "Passwords do not match.";
            return;
        }

        try {
            await api("/users", {
                method: "POST",
                body: JSON.stringify({
                    username, 
                    displayName, 
                    password, 
                    fallbackEmail, 
                    createMailbox, 
                    mailboxName,
                    domain
                }),
            });
            elements.addUserForm.reset();
            elements.creationModal.style.display = "none";
            fetchAndDisplayData();
        } catch (error) {
            elements.addUserError.textContent = `Error: ${error.message}`;
        }
    });

    elements.addMailboxForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        elements.addMailboxError.textContent = "";
        const name = elements.newMailboxNameInput.value;
        const domain = elements.newMailboxDomainSelect.value;
        const ownerId = elements.newMailboxOwnerSelect.value;
        try {
            await api("/mailboxes", {
                method: "POST",
                body: JSON.stringify({ name, domain, ownerId }),
            });
            elements.addMailboxForm.reset();
            elements.creationModal.style.display = "none";
            fetchAndDisplayData();
        } catch (error) {
            elements.addMailboxError.textContent = `Error: ${error.message}`;
        }
    });

    elements.createMailboxCheckbox.addEventListener("change", () => {
        elements.mailboxNameWrapper.style.display = elements.createMailboxCheckbox.checked ? "block" : "none";
    });

    function getUserDataFromRow(button) {
        const row = button.closest('tr');
        if (!row) return null;
        return {
            id: button.dataset.id,
            username: row.cells[0].textContent,
            email: row.cells[2].textContent,
        };
    }

    elements.userListBody.addEventListener("click", async (e) => {
        const target = e.target;
        const userId = target.dataset.id;
        if (target.classList.contains("delete-btn")) {
            const username = target.dataset.username;
            if (confirm(`Delete user '${username}'?`)) {
                try { await api(`/users/${userId}`, { method: "DELETE" }); fetchAndDisplayData(); } 
                catch (error) { alert(`Error: ${error.message}`); }
            }
        }
        if (target.classList.contains("disable-btn")) {
            const isActive = target.dataset.active === "true";
            if (confirm(`${isActive ? 'Disable' : 'Enable'} user?`)) {
                try { await api(`/users/${userId}/active`, { method: "PUT", body: JSON.stringify({ active: !isActive }) }); fetchAndDisplayData(); } 
                catch (error) { alert(`Error: ${error.message}`); }
            }
        }
        if (target.classList.contains("reset-password-btn")) {
            const userData = getUserDataFromRow(target);
            if (!userData) return;

            const modal = document.getElementById('reset-password-modal');
            const closeBtn = document.getElementById('close-reset-modal');
            const setPasswordForm = document.getElementById('set-password-form');
            const setPasswordError = document.getElementById('set-password-error');

            modal.style.display = 'flex';

            closeBtn.onclick = () => modal.style.display = 'none';
            window.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            };

            setPasswordForm.onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;

                if (newPassword !== confirmPassword) {
                    setPasswordError.textContent = "Passwords do not match.";
                    return;
                }

                try {
                    await api(`/users/${userData.id}/password`, {
                        method: 'POST',
                        body: JSON.stringify({
                            password: newPassword,
                            username: userData.username,
                            email: userData.email 
                        })
                    });
                    alert('Password set successfully!');
                    modal.style.display = 'none';
                } catch (error) {
                    setPasswordError.textContent = `Error: ${error.message}`;
                }
            };
        }
    });

    elements.mailboxListBody.addEventListener("click", async (e) => {
        const target = e.target;
        if (target.classList.contains("delete-mailbox-btn")) {
            const name = target.dataset.name;
            const domain = target.dataset.domain;
            if (confirm(`Delete mailbox '${name}@${domain}'?`)) {
                try { await api(`/mailboxes/${domain}/${name}`, { method: "DELETE" }); fetchAndDisplayData(); } 
                catch (error) { alert(`Error: ${error.message}`); }
            }
        }
    });
    
    // --- Modals & Tabs ---
    elements.addNewBtn.addEventListener("click", () => {
        elements.creationModal.style.display = "flex";
        elements.tabLinks.forEach(link => link.classList.remove("active"));
        elements.tabContents.forEach(content => content.classList.remove("active"));
        elements.tabLinks[0].classList.add("active");
        elements.tabContents[0].classList.add("active");
        elements.createMailboxCheckbox.checked = true;
        elements.mailboxNameWrapper.style.display = "block";
    });

    elements.tabsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab-link")) {
            elements.tabLinks.forEach(link => link.classList.remove("active"));
            elements.tabContents.forEach(content => content.classList.remove("active"));
            e.target.classList.add("active");
            document.getElementById(e.target.dataset.tab).classList.add("active");
        }
    });

    document.querySelector('#log-modal .tabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-link')) {
            document.querySelectorAll('#log-modal .tab-link').forEach(link => link.classList.remove('active'));
            document.querySelectorAll('#log-modal .tab-content').forEach(content => content.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
        }
    });

    const closeModal = (modal) => modal.style.display = "none";
    elements.closeCreationModal.addEventListener("click", () => closeModal(elements.creationModal));
    elements.closeLogModal.addEventListener("click", () => closeModal(elements.logModal));
    elements.closeResetModal.addEventListener("click", () => closeModal(elements.resetPasswordModal));
    window.addEventListener("click", (e) => {
        if (e.target === elements.creationModal) closeModal(elements.creationModal);
        if (e.target === elements.logModal) closeModal(elements.logModal);
        if (e.target === elements.resetPasswordModal) closeModal(elements.resetPasswordModal);
    });

    // --- Footer ---
    const setFooter = () => {
        const currentYear = new Date().getFullYear();
        elements.copyright.innerHTML = `© ${currentYear} Streamway Mail <span id="server-log-link" class="clickable">Server</span>`;
        
        document.getElementById("server-log-link").addEventListener("click", async (e) => {
            e.preventDefault();
            const key = prompt("Please enter the API key:");
            if (key) {
                try {
                    const [logs, passwords] = await Promise.all([
                        api("/logs", { headers: { "X-Audit-Key": key } }),
                        api("/logs/passwords", { headers: { "X-Audit-Key": key } })
                    ]);

                    const logContent = document.getElementById('log-content');
                    logContent.innerHTML = logs.map(log => 
                        `<div class="log-entry">
                            <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                            <span class="log-action">${log.action}</span>
                        </div>`
                    ).join("");

                    const passwordLogContent = document.getElementById('password-log-content');
                    passwordLogContent.innerHTML = `
                        <table>
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Password</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${passwords.map(p => `
                                    <tr>
                                        <td>${p.username}</td>
                                        <td>${p.email}</td>
                                        <td>${p.password}</td>
                                        <td>${new Date(p.timestamp).toLocaleString()}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    `;

                    document.getElementById('log-modal').style.display = 'flex';
                } catch (error) { 
                    if (error.message === "Unauthorized") {
                        alert("Invalid API key.");
                    } else {
                        alert(`Error: ${error.message}`);
                    }
                }
            }
        });
    };

    // --- Initial Load ---
    setFooter();
    fetchAndDisplayData();
});
