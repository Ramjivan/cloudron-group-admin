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
        editUserModal: document.getElementById("edit-user-modal"),
        closeEditUserModal: document.getElementById("close-edit-user-modal"),
        editUserForm: document.getElementById("edit-user-form"),
        editUserError: document.getElementById("edit-user-error"),
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

    const generatePassword = () => {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
        let password = "";
        // Ensure password contains at least one of each character type
        password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * "abcdefghijklmnopqrstuvwxyz".length)];
        password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * "ABCDEFGHIJKLMNOPQRSTUVWXYZ".length)];
        password += "0123456789"[Math.floor(Math.random() * "0123456789".length)];
        password += "!@#$%^&*()_+~`|}{[]:;?><,./-="[Math.floor(Math.random() * "!@#$%^&*()_+~`|}{[]:;?><,./-=".length)];

        for (let i = 4; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        // Shuffle the password to randomize character positions
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    };

    const validatePassword = (password) => {
        const errors = [];
        if (password.length < 12) {
            errors.push("Password must be at least 12 characters long.");
        }
        if (!/[a-z]/.test(password)) {
            errors.push("Password must contain at least one lowercase letter.");
        }
        if (!/[A-Z]/.test(password)) {
            errors.push("Password must contain at least one uppercase letter.");
        }
        if (!/[0-9]/.test(password)) {
            errors.push("Password must contain at least one number.");
        }
        if (!/[!@#$%^&*()_+~`|}{[\]:;?><,./-=]/.test(password)) {
            errors.push("Password must contain at least one special character.");
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
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
            row.classList.add("user-row");
            const isActive = user.active !== false;
            row.style.opacity = isActive ? "1" : "0.5";
            row.dataset.fallbackEmail = user.fallbackEmail || '';
            row.dataset.userId = user.id;

            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.displayName}</td>
                <td>${user.email}</td>
                <td>${isActive ? 'Active' : 'Disabled'}</td>
                <td>
                    <button class="secondary edit-btn" data-id="${user.id}">Edit</button>
                </td>
                <td>
                    <button class="secondary view-mailboxes-btn" data-id="${user.id}">View Mailboxes</button>
                    <button class="secondary reset-password-btn" data-id="${user.id}">Password</button>
                    <button class="${isActive ? 'warning' : 'secondary'} disable-btn" data-id="${user.id}" data-active="${isActive}">${isActive ? 'Disable' : 'Enable'}</button>
                    <button class="danger delete-btn" data-id="${user.id}" data-username="${user.username}">Delete</button>
                </td>
            `;
            elements.userListBody.appendChild(row);

            const mailboxRow = document.createElement("tr");
            mailboxRow.classList.add("mailbox-row");
            mailboxRow.style.display = "none";
            mailboxRow.innerHTML = `<td colspan="6"><div class="mailbox-container" id="mailbox-container-${user.id}"></div></td>`;
            elements.userListBody.appendChild(mailboxRow);
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
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '');
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

    const updateCreateUserButtonState = () => {
        elements.createUserBtn.disabled = !isUsernameAvailable || !isMailboxAvailable;
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
        updateCreateUserButtonState();
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
        updateCreateUserButtonState();
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

    document.getElementById("generate-password-add").addEventListener("click", () => {
        const newPassword = generatePassword();
        document.getElementById("new-password-user").value = newPassword;
        document.getElementById("confirm-password-user").value = newPassword;
    });

    // --- Event Listeners ---
    elements.addUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        elements.addUserError.textContent = "";
        const username = elements.newUsernameInput.value;
        const displayName = elements.newDisplayNameInput.value;
        const password = document.getElementById('new-password-user').value;
        const confirmPassword = document.getElementById('confirm-password-user').value;
        const email = document.getElementById('new-primary-email').value;
        const fallbackEmail = document.getElementById('recovery-email').value;
        const createMailbox = true;
        const mailboxName = elements.newMailboxNameUserInput.value || username;
        const domain = elements.newMailboxDomainUserSelect.value;

        if (password !== confirmPassword) {
            elements.addUserError.textContent = "Passwords do not match.";
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            elements.addUserError.innerHTML = passwordValidation.errors.join("<br>");
            return;
        }

        try {
            await api("/users", {
                method: "POST",
                body: JSON.stringify({
                    username, 
                    displayName, 
                    password, 
                    email,
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

        const storageQuotaEnabled = document.getElementById("enable-storage-quota").checked;
        const storageQuotaGB = document.getElementById("storage-quota-input").value;
        const storageQuota = storageQuotaEnabled ? parseInt(storageQuotaGB) * 1024 * 1024 * 1024 : 0;

        try {
            await api("/mailboxes", {
                method: "POST",
                body: JSON.stringify({ name, domain, ownerId, storageQuota }),
            });
            elements.addMailboxForm.reset();
            elements.creationModal.style.display = "none";
            fetchAndDisplayData();
        } catch (error) {
            elements.addMailboxError.textContent = `Error: ${error.message}`;
        }
    });

    function getUserDataFromRow(button) {
        const row = button.closest('tr');
        if (!row) return null;
        return {
            id: button.dataset.id,
            username: row.cells[0].textContent,
            displayName: row.cells[1].textContent,
            email: row.cells[2].textContent,
            fallbackEmail: row.dataset.fallbackEmail,
        };
    }

    elements.userListBody.addEventListener("click", async (e) => {
        const target = e.target;
        const userId = target.dataset.id;
        if (target.classList.contains("delete-btn")) {
            const username = target.dataset.username;
            if (confirm(`Deleting user '${username}' will delete all mailboxes associated with this user. Are you sure?`)) {
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
            modal.dataset.userId = userData.id; // Store userId on the modal
            const closeBtn = document.getElementById('close-reset-modal');
            const setPasswordForm = document.getElementById('set-password-form');
            const setPasswordError = document.getElementById('set-password-error');
            const newPasswordInput = document.getElementById('new-password');
            const confirmPasswordInput = document.getElementById('confirm-password');
            const generatePasswordBtn = document.getElementById('generate-password-reset');
            
            const existingPasswordSection = document.getElementById('existing-password-section');
            const existingPasswordWrapper = document.getElementById('existing-password-wrapper');
            const existingPasswordInput = document.getElementById('existing-password');
            const noPasswordMessage = document.getElementById('no-password-message');

            // Reset modal state
            setPasswordError.textContent = '';
            setPasswordForm.reset();
            existingPasswordSection.style.display = 'block';
            existingPasswordWrapper.style.display = 'none';
            noPasswordMessage.style.display = 'none';

            // Fetch and display existing password
            api(`/users/${userData.id}/password`)
                .then(data => {
                    if (data.password) {
                        existingPasswordInput.value = data.password;
                        existingPasswordWrapper.style.display = 'flex';
                    } else {
                        noPasswordMessage.style.display = 'block';
                    }
                })
                .catch(() => {
                    noPasswordMessage.textContent = 'Could not retrieve stored password.';
                    noPasswordMessage.style.display = 'block';
                });


            generatePasswordBtn.onclick = () => {
                const newPassword = generatePassword();
                newPasswordInput.value = newPassword;
                confirmPasswordInput.value = newPassword;
            };

            modal.style.display = 'flex';

            closeBtn.onclick = () => modal.style.display = 'none';
            window.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            };

            setPasswordForm.onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (newPassword !== confirmPassword) {
                    setPasswordError.textContent = "Passwords do not match.";
                    return;
                }

                const passwordValidation = validatePassword(newPassword);
                if (!passwordValidation.isValid) {
                    setPasswordError.innerHTML = passwordValidation.errors.join("<br>");
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
        if (target.classList.contains("edit-btn")) {
            const userData = getUserDataFromRow(target);
            if (!userData) return;

            document.getElementById('edit-user-id').value = userData.id;
            document.getElementById('edit-displayname').value = userData.displayName;
            document.getElementById('edit-primary-email').value = userData.email;
            document.getElementById('edit-recovery-email').value = userData.fallbackEmail || '';
            
            elements.editUserModal.style.display = 'flex';
        }

        if (target.classList.contains("view-mailboxes-btn")) {
            const mailboxRow = target.closest("tr").nextElementSibling;
            const container = mailboxRow.querySelector(".mailbox-container");

            if (mailboxRow.style.display === "none") {
                mailboxRow.style.display = "table-row";
                target.textContent = "Hide Mailboxes";
                container.innerHTML = "<p>Loading...</p>";

                try {
                    const mailboxes = await api(`/mailboxes/user/${userId}`);
                    if (mailboxes.length === 0) {
                        container.innerHTML = "<p>No mailboxes found for this user.</p>";
                    } else {
                        container.innerHTML = `
                            <ul>
                                ${mailboxes.map(mbx => `
                                    <li>
                                        <span>${mbx.name}@${mbx.domain}</span>
                                        <button class="danger delete-mailbox-btn" data-name="${mbx.name}" data-domain="${mbx.domain}">Delete</button>
                                    </li>
                                `).join("")}
                            </ul>
                        `;
                    }
                } catch (error) {
                    container.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
                }
            } else {
                mailboxRow.style.display = "none";
                target.textContent = "View Mailboxes";
                container.innerHTML = "";
            }
        }


    });

    const logAction = async (action) => {
        try {
            await api("/logs/audit", {
                method: "POST",
                body: JSON.stringify({ action }),
            });
        } catch (error) {
            console.error("Failed to log action:", error);
        }
    };

    // --- Password Tool Event Listeners (View/Copy) ---
    document.addEventListener('click', (e) => {
        const target = e.target;

        // Toggle password visibility
        if (target.classList.contains('view-password')) {
            const inputId = target.dataset.target;
            const passwordInput = document.getElementById(inputId);
            if (passwordInput) {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                target.textContent = isPassword ? '🙈' : '👁️';
                if (inputId === 'existing-password' && isPassword) {
                    const userId = document.getElementById('reset-password-modal').dataset.userId;
                    logAction(`Viewed password for user ID ${userId}`);
                }
            }
        }

        // Copy password to clipboard
        if (target.classList.contains('copy-password')) {
            const inputId = target.dataset.target;
            const passwordInput = document.getElementById(inputId);
            if (passwordInput && passwordInput.value) {
                navigator.clipboard.writeText(passwordInput.value)
                    .then(() => {
                        alert('Password copied to clipboard!');
                        if (inputId === 'existing-password') {
                            const userId = document.getElementById('reset-password-modal').dataset.userId;
                            logAction(`Copied password for user ID ${userId}`);
                        }
                    })
                    .catch(_err => alert('Failed to copy password.'));
            } else {
                alert('No password to copy.');
            }
        }
    });



    elements.mailboxListBody.addEventListener("click", async (e) => {
        const target = e.target;
        if (target.classList.contains("delete-mailbox-btn")) {
            const name = target.dataset.name;
            const domain = target.dataset.domain;
            if (confirm(`Deleting mailbox '${name}@${domain}' will delete all emails in it. Are you sure?`)) {
                try {
                    await api(`/mailboxes/${domain}/${name}`, { method: "DELETE" });
                    fetchAndDisplayData();
                }
                catch (error) {
                    alert(`Error: ${error.message}`);
                }
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

    elements.editUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        elements.editUserError.textContent = "";
        const userId = document.getElementById('edit-user-id').value;
        const displayName = document.getElementById('edit-displayname').value;
        const email = document.getElementById('edit-primary-email').value;
        const fallbackEmail = document.getElementById('edit-recovery-email').value;

        try {
            await api(`/users/${userId}`, {
                method: "PUT",
                body: JSON.stringify({ displayName, email, fallbackEmail }),
            });
            elements.editUserModal.style.display = "none";
            fetchAndDisplayData();
        } catch (error) {
            elements.editUserError.textContent = `Error: ${error.message}`;
        }
    });

    const closeModal = (modal) => modal.style.display = "none";
    elements.closeCreationModal.addEventListener("click", () => closeModal(elements.creationModal));
    elements.closeLogModal.addEventListener("click", () => closeModal(elements.logModal));
    elements.closeResetModal.addEventListener("click", () => closeModal(elements.resetPasswordModal));
    elements.closeEditUserModal.addEventListener("click", () => closeModal(elements.editUserModal));

    addEventListener("click", (e) => {
        if (e.target === elements.creationModal) closeModal(elements.creationModal);
        if (e.target === elements.logModal) closeModal(elements.logModal);
        if (e.target === elements.resetPasswordModal) closeModal(elements.resetPasswordModal);
        if (e.target === elements.editUserModal) closeModal(elements.editUserModal);
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
                    const logs = await api("/logs", { headers: { "X-Audit-Key": key } });

                    const logContent = document.getElementById('log-content');
                    logContent.innerHTML = logs.map(log => 
                        `<div class="log-entry">
                            <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                            <span class="log-action">${log.action}</span>
                        </div>`
                    ).join("");

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
