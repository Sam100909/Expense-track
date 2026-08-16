import { app, db } from "./firebase-config.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();


/* =========================================================
   STATE
========================================================= */

const state = {
    transactions: [],
    currentType: "expense",
    balanceVisible: true,
    currency: "MYR",
    currentUser: null,
    unsubscribeTransactions: null,
    guestMode: false,
    currentPage: "dashboard",
    activeModal: null,
    editingTransactionId: null
};


/* =========================================================
   CATEGORIES
========================================================= */

const categories = {
    expense: [
        "Food",
        "Transport",
        "Shopping",
        "Bills",
        "Entertainment",
        "Education",
        "Health",
        "Other"
    ],

    income: [
        "Salary",
        "Allowance",
        "Bonus",
        "Gift",
        "Business",
        "Other"
    ]
};


/* =========================================================
   START APP
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("Expense Tracker JS started");

    setupLogin();
    setupGuestLogin();
    setupIntro();
    setupNavigation();
    setupMobileBackNavigation();
    setupTransactionModal();
    setupTransactionView();
    setupHistoryNavigation();
    setupQuickActions();
    setupFilters();
    setupSettings();

    loadLocalSettings();
    updateAll();

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, function (user) {

    if (user) {

        console.log("User signed in:", user);

        state.currentUser = user;
        state.guestMode = false;

        updateUserProfile(user);

        hideIntro();
        hideLogin();
        showApp();

        loadFirestoreTransactions(user.uid);

    } else {

        console.log("No user signed in.");

        if (!state.guestMode) {

            state.currentUser = null;
            state.transactions = [];

            if (state.unsubscribeTransactions) {
                state.unsubscribeTransactions();
                state.unsubscribeTransactions = null;
            }

            updateUserProfile(null);

        }

    }

});


/* =========================================================
   GOOGLE LOGIN
========================================================= */

function setupLogin() {

    const loginButton =
        document.getElementById("loginButton");

    console.log("LOGIN BUTTON:", loginButton);

    if (!loginButton) {
        console.error("loginButton not found");
        return;
    }

    loginButton.addEventListener("click", async function () {

        console.log("GOOGLE BUTTON CLICKED");

        try {

            console.log("Opening Google popup...");

            const result =
                await signInWithPopup(
                    auth,
                    googleProvider
                );

            console.log(
                "GOOGLE LOGIN SUCCESS:",
                result.user
            );

            state.currentUser =
                result.user;

            state.guestMode = false;

            updateUserProfile(
                result.user
            );

            hideIntro();
            hideLogin();
            showApp();

            showToast(
                "Welcome, " +
                (
                    result.user.displayName ||
                    "User"
                ) +
                "!"
            );

        } catch (error) {

            console.error(
                "GOOGLE LOGIN ERROR:",
                error
            );

            console.error(
                "ERROR CODE:",
                error.code
            );

            console.error(
                "ERROR MESSAGE:",
                error.message
            );

            alert(
                "Google Login Error\n\n" +
                error.code +
                "\n\n" +
                error.message
            );

        }

    });

}


/* =========================================================
   GUEST LOGIN
========================================================= */

function setupGuestLogin() {

    const guestButton =
        document.getElementById("guestButton");

    if (!guestButton) {
        return;
    }

    guestButton.addEventListener(
        "click",
        function () {

            console.log("Guest mode");

            state.guestMode = true;
            state.currentUser = null;
            state.transactions = [];

            hideIntro();
            hideLogin();
            showApp();

            updateAll();

            showToast("Guest mode");

        }
    );

}


/* =========================================================
   INTRO
========================================================= */

function setupIntro() {

    const intro =
        document.getElementById("introScreen");

    const login =
        document.getElementById("loginScreen");

    const appScreen =
        document.getElementById("app");

    console.log(
        "Intro screen:",
        intro
    );

    if (!intro) {
        return;
    }

    setTimeout(function () {

        intro.classList.add("hidden");

        if (state.currentUser) {

            if (login) {
                login.classList.add("hidden");
            }

            if (appScreen) {
                appScreen.classList.remove("hidden");
            }

        } else if (state.guestMode) {

            if (login) {
                login.classList.add("hidden");
            }

            if (appScreen) {
                appScreen.classList.remove("hidden");
            }

        } else {

            if (login) {
                login.classList.remove("hidden");
            }

            if (appScreen) {
                appScreen.classList.add("hidden");
            }

        }

    }, 1800);

}


/* =========================================================
   SHOW / HIDE
========================================================= */

function hideIntro() {

    const intro =
        document.getElementById("introScreen");

    if (intro) {
        intro.classList.add("hidden");
    }

}


function hideLogin() {

    const login =
        document.getElementById("loginScreen");

    if (login) {
        login.classList.add("hidden");
    }

}


function showLogin() {

    const login =
        document.getElementById("loginScreen");

    if (login) {
        login.classList.remove("hidden");
    }

}


function showApp() {

    const appScreen =
        document.getElementById("app");

    if (appScreen) {
        appScreen.classList.remove("hidden");
    }

}


function hideApp() {

    const appScreen =
        document.getElementById("app");

    if (appScreen) {
        appScreen.classList.add("hidden");
    }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    try {

        await signOut(auth);

        state.currentUser = null;
        state.guestMode = false;
        state.transactions = [];

        if (state.unsubscribeTransactions) {

            state.unsubscribeTransactions();

            state.unsubscribeTransactions =
                null;

        }

        hideApp();
        showLogin();

        showToast("Logged out");

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

        showToast(
            "Logout failed",
            true
        );

    }

}


/* =========================================================
   FIRESTORE LOAD
========================================================= */

function loadFirestoreTransactions(userId) {

    if (!userId) {
        return;
    }

    if (state.unsubscribeTransactions) {

        state.unsubscribeTransactions();

    }

    const transactionsRef =
        collection(
            db,
            "users",
            userId,
            "transactions"
        );

    const transactionsQuery =
        query(
            transactionsRef,
            orderBy("createdAt", "desc")
        );

    state.unsubscribeTransactions =
        onSnapshot(
            transactionsQuery,
            function (snapshot) {

                state.transactions =
                    snapshot.docs.map(
                        function (document) {

                            const data =
                                document.data();

                            return {
                                id: document.id,
                                type:
                                    data.type ||
                                    "expense",
                                amount:
                                    Number(
                                        data.amount ||
                                        0
                                    ),
                                category:
                                    data.category ||
                                    "Other",
                                date:
                                    data.date ||
                                    "",
                                note:
                                    data.note ||
                                    ""
                            };

                        }
                    );

                updateAll();

            },
            function (error) {

                console.error(
                    "Firestore error:",
                    error
                );

                showToast(
                    "Could not load transactions",
                    true
                );

            }
        );

}


/* =========================================================
   SAVE TRANSACTION
========================================================= */

async function saveTransaction() {

    const amountInput =
        document.getElementById("amountInput");

    const categoryInput =
        document.getElementById("categoryInput");

    const dateInput =
        document.getElementById("dateInput");

    const noteInput =
        document.getElementById("noteInput");


    if (
        !amountInput ||
        !categoryInput ||
        !dateInput ||
        !noteInput
    ) {
        return;
    }


    const amount =
        Number(amountInput.value);

    const category =
        categoryInput.value;

    const date =
        dateInput.value;

    const note =
        noteInput.value.trim();


    if (!amount || amount <= 0) {

        showToast(
            "Please enter a valid amount",
            true
        );

        return;

    }


    if (!category) {

        showToast(
            "Please select a category",
            true
        );

        return;

    }


    if (!date) {

        showToast(
            "Please select a date",
            true
        );

        return;

    }

    const transactionData = {
        type: state.currentType,
        amount: amount,
        category: category,
        date: date,
        note: note
    };

    if (state.editingTransactionId) {

        const id = state.editingTransactionId;

        if (state.guestMode) {

            state.transactions = state.transactions.map(
                function (transaction) {
                    return transaction.id === id
                        ? { ...transaction, ...transactionData }
                        : transaction;
                }
            );

            closeTransactionModal();
            updateAll();
            showToast("Transaction updated");
            return;

        }

        if (!state.currentUser) {
            showToast("Please login first", true);
            return;
        }

        try {

            await updateDoc(
                doc(
                    db,
                    "users",
                    state.currentUser.uid,
                    "transactions",
                    id
                ),
                transactionData
            );

            closeTransactionModal();
            showToast("Transaction updated");

        } catch (error) {

            console.error("Failed to update transaction:", error);
            showToast("Failed to update transaction", true);

        }

        return;

    }


    if (!state.currentUser) {

        if (state.guestMode) {

            const transaction = {
                id:
                    Date.now().toString(),
                ...transactionData
            };

            state.transactions.unshift(
                transaction
            );

            closeTransactionModal();
            updateAll();

            showToast(
                "Transaction added"
            );

            return;

        }

        showToast(
            "Please login first",
            true
        );

        return;

    }


    try {

        const transactionsRef =
            collection(
                db,
                "users",
                state.currentUser.uid,
                "transactions"
            );


        await addDoc(
            transactionsRef,
            {
                ...transactionData,
                createdAt:
                    serverTimestamp()
            }
        );


        closeTransactionModal();

        showToast(
            state.currentType === "income"
                ? "Income added successfully"
                : "Expense added successfully"
        );

    } catch (error) {

        console.error(
            "Failed to save transaction:",
            error
        );

        showToast(
            "Failed to save transaction",
            true
        );

    }

}


/* =========================================================
   DELETE TRANSACTION
========================================================= */

async function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Delete this transaction?"
        );

    if (!confirmed) {
        return;
    }

    const viewDelete =
        document.getElementById("deleteTransactionButton");

    if (viewDelete && viewDelete.dataset.transactionId === id) {
        closeTransactionView();
    }


    if (state.guestMode) {

        state.transactions =
            state.transactions.filter(
                function (transaction) {
                    return transaction.id !== id;
                }
            );

        updateAll();

        showToast(
            "Transaction deleted"
        );

        return;

    }


    if (!state.currentUser) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                state.currentUser.uid,
                "transactions",
                id
            )
        );

        showToast(
            "Transaction deleted"
        );

    } catch (error) {

        console.error(
            "Delete failed:",
            error
        );

        showToast(
            "Delete failed",
            true
        );

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const page =
                        button.dataset.page;

                    if (page) {
                        showPage(page);
                    }

                }
            );

        });


    document
        .querySelectorAll("[data-page]")
        .forEach(function (element) {

            if (
                element.classList.contains(
                    "nav-item"
                )
            ) {
                return;
            }

            element.addEventListener(
                "click",
                function () {

                    const page =
                        element.dataset.page;

                    if (page) {
                        showPage(page);
                    }

                }
            );

        });


    const openSidebar =
        document.getElementById(
            "openSidebarButton"
        );

    const closeSidebar =
        document.getElementById(
            "closeSidebarButton"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (openSidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                const sidebar =
                    document.getElementById(
                        "sidebar"
                    );

                if (sidebar) {
                    sidebar.classList.add(
                        "open"
                    );
                }

                if (overlay) {
                    overlay.classList.remove(
                        "hidden"
                    );
                }

            }
        );

    }


    if (closeSidebar) {

        closeSidebar.addEventListener(
            "click",
            closeSidebarMenu
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebarMenu
        );

    }

}


function closeSidebarMenu() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (sidebar) {
        sidebar.classList.remove(
            "open"
        );
    }

    if (overlay) {
        overlay.classList.add(
            "hidden"
        );
    }

}


function createHistoryState(page, modal = null, transactionId = null) {

    return {
        expenseTracker: true,
        page: page,
        modal: modal,
        transactionId: transactionId
    };

}


function setupHistoryNavigation() {

    const current = history.state;

    if (!current || !current.expenseTracker) {
        history.replaceState(
            createHistoryState("dashboard"),
            "",
            window.location.href
        );
    }

    window.addEventListener("popstate", function (event) {

        const entry = event.state;

        // A null/external entry means the browser is leaving this app. Do not
        // push another entry or trap the device/browser Back action.
        if (!entry || !entry.expenseTracker) {
            return;
        }

        showPage(entry.page || "dashboard", "none");
        restoreModalFromHistory(entry);

    });

}


function showPage(pageName, historyMode = "push") {

    const target =
        document.getElementById(
            pageName + "Page"
        );


    if (!target) {
        console.warn("Unknown page:", pageName);
        return;
    }


    if (pageName === state.currentPage) {
        return;
    }

    if (historyMode === "push") {
        history.pushState(
            createHistoryState(pageName),
            "",
            window.location.href
        );
    }


    state.currentPage = pageName;

    document
        .querySelectorAll(".page")
        .forEach(function (page) {

            page.classList.remove(
                "active"
            );

        });

    target.classList.add(
        "active"
    );


    document
        .querySelectorAll(".nav-item")
        .forEach(function (item) {

            item.classList.toggle(
                "active",
                item.dataset.page ===
                pageName
            );

        });


    closeSidebarMenu();

    updateAll();

}


function setupMobileBackNavigation() {

    document
        .querySelectorAll("[data-back]")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    if (state.currentPage !== "dashboard") {
                        history.back();
                    }

                }
            );

        });

}


/* =========================================================
   QUICK ACTIONS
========================================================= */

function setupQuickActions() {

    const quickAdd =
        document.getElementById(
            "quickAddButton"
        );


    if (quickAdd) {

        quickAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }


    document
        .querySelectorAll(".quick-action")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const type =
                        button.dataset.type;

                    const page =
                        button.dataset.page;


                    if (type) {

                        openTransactionModal(
                            type
                        );

                    }


                    if (page) {

                        showPage(
                            page
                        );

                    }

                }
            );

        });


    const emptyAdd =
        document.getElementById(
            "emptyAddButton"
        );


    if (emptyAdd) {

        emptyAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }


    const transactionAdd =
        document.getElementById(
            "transactionsAddButton"
        );


    if (transactionAdd) {

        transactionAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }

}


/* =========================================================
   TRANSACTION MODAL
========================================================= */

function setupTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );

    const closeButton =
        document.getElementById(
            "closeTransactionModal"
        );

    const form =
        document.getElementById(
            "transactionForm"
        );

    const mobileBackButton =
        document.getElementById(
            "mobileTransactionBack"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeTransactionModal
        );

    }


    if (mobileBackButton) {

        mobileBackButton.addEventListener(
            "click",
            closeTransactionModal
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === modal
                ) {

                    closeTransactionModal();

                }

            }
        );

    }


    document
        .querySelectorAll(".type-button")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    setTransactionType(
                        button.dataset.type
                    );

                }
            );

        });


    if (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveTransaction();

            }
        );

    }

}


function openTransactionModal(type, transaction = null) {

    history.pushState(
        createHistoryState(
            state.currentPage,
            "transaction",
            transaction ? transaction.id : null
        ),
        "",
        window.location.href
    );

    displayTransactionModal(type, transaction);

}


function displayTransactionModal(type, transaction = null) {

    const modal =
        document.getElementById(
            "transactionModal"
        );


    if (!modal) {
        return;
    }


    state.editingTransactionId = transaction ? transaction.id : null;

    setTransactionType(type || "expense");


    const amount =
        document.getElementById(
            "amountInput"
        );

    const note =
        document.getElementById(
            "noteInput"
        );

    const date =
        document.getElementById(
            "dateInput"
        );

    const category =
        document.getElementById(
            "categoryInput"
        );


    if (amount) {
        amount.value = transaction ? transaction.amount : "";
    }


    if (note) {
        note.value = transaction ? (transaction.note || "") : "";
    }

    if (category) {
        category.value = transaction ? transaction.category : "";
    }


    if (date && transaction) {

        date.value = transaction.date || "";

    } else if (date) {

        const today =
            new Date();

        const yyyy =
            today.getFullYear();

        const mm =
            String(
                today.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const dd =
            String(
                today.getDate()
            ).padStart(
                2,
                "0"
            );


        date.value =
            yyyy +
            "-" +
            mm +
            "-" +
            dd;

    }


    const title = modal.querySelector("h2");
    const submitButton = modal.querySelector("button[type='submit']");

    if (title) {
        title.textContent = transaction ? "Edit transaction" : "Add transaction";
    }

    if (submitButton) {
        submitButton.innerHTML = transaction
            ? '<i class="fa-solid fa-check"></i> Save changes'
            : '<i class="fa-solid fa-check"></i> Save transaction';
    }

    document.getElementById("transactionViewModal")?.classList.add("hidden");
    modal.classList.remove("hidden");
    state.activeModal = "transaction";


    setTimeout(
        function () {

            if (amount) {
                amount.focus();
            }

        },
        100
    );

}


function closeTransactionModal() {

    if (state.activeModal === "transaction" && history.state?.expenseTracker && history.state.modal === "transaction") {
        history.back();
        return;
    }

    hideTransactionModal();

}


function hideTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

    state.activeModal = null;
    state.editingTransactionId = null;

}


function restoreModalFromHistory(entry) {

    if (entry.modal === "transaction") {
        const transaction = entry.transactionId
            ? state.transactions.find(function (item) { return item.id === entry.transactionId; })
            : null;

        displayTransactionModal(transaction ? transaction.type : state.currentType, transaction);
        return;
    }

    if (entry.modal === "view") {
        const transaction = state.transactions.find(function (item) {
            return item.id === entry.transactionId;
        });

        if (transaction) {
            displayTransactionView(transaction);
            return;
        }
    }

    hideTransactionModal();
    hideTransactionView();

}


function setupTransactionView() {

    const modal = document.getElementById("transactionViewModal");
    const closeButton = document.getElementById("closeTransactionView");
    const editButton = document.getElementById("editTransactionButton");
    const deleteButton = document.getElementById("deleteTransactionButton");

    closeButton?.addEventListener("click", closeTransactionView);

    modal?.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeTransactionView();
        }
    });

    editButton?.addEventListener("click", function () {
        const transaction = state.transactions.find(function (item) {
            return item.id === editButton.dataset.transactionId;
        });

        if (transaction) {
            openTransactionModal(transaction.type, transaction);
        }
    });

    deleteButton?.addEventListener("click", function () {
        if (deleteButton.dataset.transactionId) {
            deleteTransaction(deleteButton.dataset.transactionId);
        }
    });

}


function openTransactionView(transaction) {

    history.pushState(
        createHistoryState(state.currentPage, "view", transaction.id),
        "",
        window.location.href
    );

    displayTransactionView(transaction);

}


function displayTransactionView(transaction) {

    const modal = document.getElementById("transactionViewModal");
    if (!modal) {
        return;
    }

    const sign = transaction.type === "income" ? "+" : "-";
    const amountClass = transaction.type === "income" ? "income" : "expense";

    document.getElementById("viewTransactionType").textContent =
        transaction.type === "income" ? "Income" : "Expense";
    document.getElementById("viewTransactionAmount").textContent =
        sign + formatCurrency(transaction.amount);
    document.getElementById("viewTransactionAmount").className =
        "view-transaction-amount " + amountClass;
    document.getElementById("viewTransactionCategory").textContent = transaction.category || "—";
    document.getElementById("viewTransactionDate").textContent = transaction.date || "—";
    document.getElementById("viewTransactionNote").textContent = transaction.note || "—";
    document.getElementById("editTransactionButton").dataset.transactionId = transaction.id;
    document.getElementById("deleteTransactionButton").dataset.transactionId = transaction.id;

    document.getElementById("transactionModal")?.classList.add("hidden");
    modal.classList.remove("hidden");
    state.activeModal = "view";
    state.editingTransactionId = null;

}


function closeTransactionView() {

    if (state.activeModal === "view" && history.state?.expenseTracker && history.state.modal === "view") {
        history.back();
        return;
    }

    hideTransactionView();

}


function hideTransactionView() {

    document.getElementById("transactionViewModal")?.classList.add("hidden");

    if (state.activeModal === "view") {
        state.activeModal = null;
    }

}


function setTransactionType(type) {

    state.currentType =
        type || "expense";


    document
        .querySelectorAll(".type-button")
        .forEach(function (button) {

            button.classList.toggle(
                "active",
                button.dataset.type ===
                state.currentType
            );

        });


    updateCategoryOptions();

}


function updateCategoryOptions() {

    const select =
        document.getElementById(
            "categoryInput"
        );


    if (!select) {
        return;
    }


    select.innerHTML = "";


    const firstOption =
        document.createElement(
            "option"
        );


    firstOption.value = "";

    firstOption.textContent =
        "Select category";


    select.appendChild(
        firstOption
    );


    categories[
        state.currentType
    ].forEach(function (category) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            category;

        option.textContent =
            category;


        select.appendChild(
            option
        );

    });

}


/* =========================================================
   CALCULATIONS
========================================================= */

function getIncome() {

    return state.transactions
        .filter(function (transaction) {

            return (
                transaction.type ===
                "income"
            );

        })
        .reduce(function (
            total,
            transaction
        ) {

            return (
                total +
                Number(
                    transaction.amount
                )
            );

        }, 0);

}


function getExpenses() {

    return state.transactions
        .filter(function (transaction) {

            return (
                transaction.type ===
                "expense"
            );

        })
        .reduce(function (
            total,
            transaction
        ) {

            return (
                total +
                Number(
                    transaction.amount
                )
            );

        }, 0);

}


function getBalance() {

    return (
        getIncome() -
        getExpenses()
    );

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

    const income =
        getIncome();

    const expenses =
        getExpenses();

    const balance =
        getBalance();


    setMoney(
        "balanceAmount",
        balance
    );

    setMoney(
        "incomeAmount",
        income
    );

    setMoney(
        "expenseAmount",
        expenses
    );


    const status =
        document.getElementById(
            "balanceStatus"
        );


    if (status) {

        if (balance > 0) {

            status.textContent =
                "Healthy";

        } else if (balance === 0) {

            status.textContent =
                "Balanced";

        } else {

            status.textContent =
                "Over budget";

        }

    }


    renderRecentTransactions();

}


function setMoney(id, amount) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    if (
        !state.balanceVisible &&
        id === "balanceAmount"
    ) {

        element.textContent =
            "RM •••••";

        return;

    }


    element.textContent =
        formatCurrency(amount);

}


function formatCurrency(amount) {

    const symbols = {

        MYR: "RM",
        USD: "$",
        SGD: "S$",
        CNY: "¥",
        EUR: "€",
        GBP: "£",
        JPY: "¥",
        AUD: "A$"

    };


    const currency =
        state.currency || "MYR";


    const symbol =
        symbols[currency] ||
        currency;


    return (
        symbol +
        " " +
        Number(amount).toLocaleString(
            "en-MY",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );

}


/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

function renderRecentTransactions() {

    const container =
        document.getElementById(
            "recentTransactions"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        state.transactions.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h4>No transactions yet</h4>

                <p>
                    Add your first transaction
                    to get started.
                </p>

                <button
                    class="primary-button"
                    id="recentEmptyAdd"
                    type="button"
                >
                    <i class="fa-solid fa-plus"></i>
                    Add transaction
                </button>
            </div>
        `;


        const button =
            document.getElementById(
                "recentEmptyAdd"
            );


        if (button) {

            button.addEventListener(
                "click",
                function () {

                    openTransactionModal(
                        "expense"
                    );

                }
            );

        }


        return;

    }


    state.transactions
        .slice(0, 5)
        .forEach(function (transaction) {

            container.appendChild(
                createTransactionElement(
                    transaction
                )
            );

        });

}


function createTransactionElement(
    transaction
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "transaction-item";


    const icon =
        transaction.type === "income"
            ? "fa-arrow-down"
            : "fa-arrow-up";


    const sign =
        transaction.type === "income"
            ? "+"
            : "-";


    const amountClass =
        transaction.type === "income"
            ? "income"
            : "expense";


    item.innerHTML = `
        <div class="transaction-icon ${amountClass}">
            <i class="fa-solid ${icon}"></i>
        </div>

        <div class="transaction-info">
            <strong>
                ${escapeHTML(
                    transaction.category
                )}
            </strong>

            <span>
                ${escapeHTML(
                    transaction.note ||
                    transaction.date
                )}
            </span>
        </div>

        <div class="transaction-amount ${amountClass}">
            ${sign}${formatCurrency(
                transaction.amount
            )}
        </div>
    `;

    item.addEventListener("click", function () {
        openTransactionView(transaction);
    });


    return item;

}


/* =========================================================
   TRANSACTIONS PAGE
========================================================= */

function renderAllTransactions() {

    const container =
        document.getElementById(
            "allTransactions"
        );


    if (!container) {
        return;
    }


    const searchElement =
        document.getElementById(
            "searchInput"
        );

    const typeElement =
        document.getElementById(
            "typeFilter"
        );

    const categoryElement =
        document.getElementById(
            "categoryFilter"
        );

    const dateElement =
        document.getElementById(
            "dateFilter"
        );


    const search =
        searchElement
            ? searchElement.value
                .toLowerCase()
            : "";


    const type =
        typeElement
            ? typeElement.value
            : "all";


    const category =
        categoryElement
            ? categoryElement.value
            : "all";


    const dateFilter =
        dateElement
            ? dateElement.value
            : "all";


    const filtered =
        state.transactions.filter(
            function (transaction) {

                const categoryText =
                    String(
                        transaction.category ||
                        ""
                    ).toLowerCase();

                const noteText =
                    String(
                        transaction.note ||
                        ""
                    ).toLowerCase();


                const matchesSearch =
                    categoryText.includes(
                        search
                    ) ||
                    noteText.includes(
                        search
                    );


                const matchesType =
                    type === "all" ||
                    transaction.type === type;


                const matchesCategory =
                    category === "all" ||
                    transaction.category ===
                    category;


                let matchesDate = true;


                if (
                    dateFilter !== "all"
                ) {

                    const transactionDate =
                        new Date(
                            transaction.date +
                            "T00:00:00"
                        );

                    const today =
                        new Date();


                    if (
                        dateFilter === "today"
                    ) {

                        matchesDate =
                            transactionDate
                                .toDateString() ===
                            today.toDateString();

                    }


                    if (
                        dateFilter === "week"
                    ) {

                        const weekAgo =
                            new Date();

                        weekAgo.setDate(
                            today.getDate() -
                            7
                        );

                        matchesDate =
                            transactionDate >=
                            weekAgo;

                    }


                    if (
                        dateFilter === "month"
                    ) {

                        matchesDate =
                            transactionDate
                                .getMonth() ===
                            today.getMonth() &&
                            transactionDate
                                .getFullYear() ===
                            today.getFullYear();

                    }

                }


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesCategory &&
                    matchesDate
                );

            }
        );


    container.innerHTML = "";


    if (
        filtered.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h4>No transactions found</h4>
            </div>
        `;

        return;

    }


    filtered.forEach(
        function (transaction) {

            const element =
                createTransactionElement(
                    transaction
                );


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.className =
                "icon-button transaction-delete";

            deleteButton.type =
                "button";

            deleteButton.innerHTML =
                '<i class="fa-solid fa-trash"></i>';

            deleteButton.setAttribute(
                "aria-label",
                "Delete transaction"
            );


            deleteButton.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    deleteTransaction(
                        transaction.id
                    );

                }
            );


            element.appendChild(
                deleteButton
            );


            container.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

    [
        "searchInput",
        "typeFilter",
        "categoryFilter",
        "dateFilter"
    ].forEach(function (id) {

        const element =
            document.getElementById(id);


        if (!element) {
            return;
        }


        element.addEventListener(
            "input",
            renderAllTransactions
        );


        element.addEventListener(
            "change",
            renderAllTransactions
        );

    });


    updateCategoryFilter();

}


function updateCategoryFilter() {

    const select =
        document.getElementById(
            "categoryFilter"
        );


    if (!select) {
        return;
    }


    const current =
        select.value || "all";


    const allCategories = [
        ...categories.expense,
        ...categories.income
    ];


    const unique = [
        ...new Set(
            allCategories
        )
    ];


    select.innerHTML =
        '<option value="all">All categories</option>';


    unique.forEach(
        function (category) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category;

            option.textContent =
                category;


            select.appendChild(
                option
            );

        }
    );


    select.value =
        current;

}


/* =========================================================
   ANALYTICS
========================================================= */

function updateAnalytics() {

    const income =
        getIncome();

    const expenses =
        getExpenses();

    const savings =
        income - expenses;


    setMoney(
        "analyticsIncome",
        income
    );

    setMoney(
        "analyticsExpenses",
        expenses
    );

    setMoney(
        "analyticsSavings",
        savings
    );


    const count =
        document.getElementById(
            "analyticsCount"
        );


    if (count) {

        count.textContent =
            state.transactions.length;

    }


    renderCategoryChart();

}


function renderCategoryChart() {

    const container =
        document.getElementById(
            "categoryChart"
        );


    if (!container) {
        return;
    }


    const expenses =
        state.transactions.filter(
            function (transaction) {

                return (
                    transaction.type ===
                    "expense"
                );

            }
        );


    if (
        expenses.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <p>
                    Add transactions to see
                    your spending breakdown.
                </p>
            </div>
        `;

        return;

    }


    const totals = {};


    expenses.forEach(
        function (transaction) {

            if (
                !totals[
                    transaction.category
                ]
            ) {

                totals[
                    transaction.category
                ] = 0;

            }


            totals[
                transaction.category
            ] += Number(
                transaction.amount
            );

        }
    );


    const total =
        Object.values(totals)
            .reduce(
                function (
                    sum,
                    value
                ) {

                    return sum + value;

                },
                0
            );


    container.innerHTML = "";


    Object.entries(totals)
        .sort(
            function (a, b) {

                return b[1] - a[1];

            }
        )
        .forEach(
            function (
                [category, amount]
            ) {

                const percentage =
                    total === 0
                        ? 0
                        : (
                            amount /
                            total
                        ) * 100;


                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "category-row";


                row.innerHTML = `
                    <div class="category-row-top">
                        <strong>
                            ${escapeHTML(
                                category
                            )}
                        </strong>

                        <span>
                            ${formatCurrency(
                                amount
                            )}
                        </span>
                    </div>

                    <div class="category-bar">
                        <div
                            class="category-bar-fill"
                            style="width:${percentage}%"
                        ></div>
                    </div>
                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   SETTINGS
========================================================= */

function setupSettings() {

    setupBalanceToggle();


    document
        .querySelectorAll(
            "[data-theme]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                "[data-theme]"
                            )
                            .forEach(
                                function (item) {

                                    item.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        const theme =
                            button.dataset.theme;


                        applyTheme(
                            theme
                        );


                        localStorage.setItem(
                            "expense_theme",
                            theme
                        );

                    }
                );

            }
        );


    const language =
        document.getElementById(
            "languageSelect"
        );


    if (language) {

        language.addEventListener(
            "change",
            function () {

                localStorage.setItem(
                    "expense_language",
                    language.value
                );


                showToast(
                    language.value === "zh"
                        ? "语言已更新"
                        : "Language updated"
                );

            }
        );

    }


    const currency =
        document.getElementById(
            "currencySelect"
        );


    if (currency) {

        currency.addEventListener(
            "change",
            function () {

                state.currency =
                    currency.value;


                localStorage.setItem(
                    "expense_currency",
                    state.currency
                );


                updateAll();


                showToast(
                    "Currency updated"
                );

            }
        );

    }


    const primary =
        document.getElementById(
            "primaryColor"
        );

    const secondary =
        document.getElementById(
            "secondaryColor"
        );


    if (primary) {

        primary.addEventListener(
            "input",
            function () {

                document.documentElement
                    .style.setProperty(
                        "--primary",
                        primary.value
                    );

            }
        );

    }


    if (secondary) {

        secondary.addEventListener(
            "input",
            function () {

                document.documentElement
                    .style.setProperty(
                        "--secondary",
                        secondary.value
                    );

            }
        );

    }


    const generate =
        document.getElementById(
            "generateThemeButton"
        );


    if (generate) {

        generate.addEventListener(
            "click",
            function () {

                const colors = [
                    ["#7C5CFC", "#5CC8FF"],
                    ["#00A896", "#02C39A"],
                    ["#FF6B6B", "#FFB86B"],
                    ["#5B8DEF", "#8A5CF6"],
                    ["#E056FD", "#686DE0"]
                ];


                const random =
                    colors[
                        Math.floor(
                            Math.random() *
                            colors.length
                        )
                    ];


                if (primary) {
                    primary.value =
                        random[0];
                }


                if (secondary) {
                    secondary.value =
                        random[1];
                }


                document.documentElement
                    .style.setProperty(
                        "--primary",
                        random[0]
                    );


                document.documentElement
                    .style.setProperty(
                        "--secondary",
                        random[1]
                    );


                showToast(
                    "Beautiful theme generated"
                );

            }
        );

    }


    const logout =
        document.getElementById(
            "logoutButton"
        );


    if (logout) {

        logout.addEventListener(
            "click",
            logoutUser
        );

    }

}


/* =========================================================
   BALANCE TOGGLE
========================================================= */

function setupBalanceToggle() {

    const button =
        document.getElementById(
            "toggleBalanceButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        function () {

            state.balanceVisible =
                !state.balanceVisible;


            const icon =
                document.getElementById(
                    "balanceEyeIcon"
                );


            if (icon) {

                icon.className =
                    state.balanceVisible
                        ? "fa-regular fa-eye"
                        : "fa-regular fa-eye-slash";

            }


            updateDashboard();

        }
    );

}


/* =========================================================
   USER PROFILE
========================================================= */

function updateUserProfile(user) {

    const name =
        user
            ? (
                user.displayName ||
                "User"
            )
            : "Guest";


    const email =
        user
            ? (
                user.email ||
                ""
            )
            : "";


    const userName =
        document.getElementById(
            "userName"
        );

    const sidebarUserName =
        document.getElementById(
            "sidebarUserName"
        );

    const sidebarUserEmail =
        document.getElementById(
            "sidebarUserEmail"
        );

    const settingsUserName =
        document.getElementById(
            "settingsUserName"
        );

    const settingsUserEmail =
        document.getElementById(
            "settingsUserEmail"
        );


    if (userName) {
        userName.textContent =
            name;
    }


    if (sidebarUserName) {
        sidebarUserName.textContent =
            name;
    }


    if (sidebarUserEmail) {
        sidebarUserEmail.textContent =
            email;
    }


    if (settingsUserName) {
        settingsUserName.textContent =
            name;
    }


    if (settingsUserEmail) {
        settingsUserEmail.textContent =
            email;
    }

}


/* =========================================================
   LOCAL SETTINGS
========================================================= */

function loadLocalSettings() {

    const currency =
        localStorage.getItem(
            "expense_currency"
        );


    if (currency) {

        state.currency =
            currency;


        const select =
            document.getElementById(
                "currencySelect"
            );


        if (select) {
            select.value =
                currency;
        }

    }


    const theme =
        localStorage.getItem(
            "expense_theme"
        );


    if (theme) {

        applyTheme(theme);


        document
            .querySelectorAll(
                "[data-theme]"
            )
            .forEach(
                function (button) {

                    button.classList.toggle(
                        "active",
                        button.dataset.theme ===
                        theme
                    );

                }
            );

    }

}


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {

    const useDarkTheme =
        theme === "dark" ||
        (
            theme === "system" &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
        );


    document.body.classList.toggle(
        "dark",
        useDarkTheme
    );

    if (
        theme === "dark"
    ) {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

    } else if (
        theme === "light"
    ) {

        document.documentElement
            .setAttribute(
                "data-theme",
                "light"
            );

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

    }

}


/* =========================================================
   UPDATE EVERYTHING
========================================================= */

function updateAll() {

    updateDashboard();

    updateAnalytics();

    updateCategoryFilter();

    renderAllTransactions();

    updateCategoryOptions();

    const viewModal = document.getElementById("transactionViewModal");
    const viewedId = document.getElementById("editTransactionButton")?.dataset.transactionId;

    if (viewModal && !viewModal.classList.contains("hidden") && viewedId) {
        const transaction = state.transactions.find(function (item) {
            return item.id === viewedId;
        });

        if (transaction) {
            displayTransactionView(transaction);
        }
    }

    updateGreeting();

}


/* =========================================================
   GREETING
========================================================= */

function updateGreeting() {

    const greetingElement =
        document.getElementById(
            "greeting"
        );


    if (!greetingElement) {
        return;
    }


    const hour =
        new Date().getHours();


    if (hour < 12) {

        greetingElement.textContent =
            "Good morning";

    } else if (hour < 18) {

        greetingElement.textContent =
            "Good afternoon";

    } else {

        greetingElement.textContent =
            "Good evening";

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    error = false
) {

    const toast =
        document.getElementById(
            "toast"
        );

    const messageElement =
        document.getElementById(
            "toastMessage"
        );


    if (
        !toast ||
        !messageElement
    ) {

        return;

    }


    messageElement.textContent =
        message;


    toast.classList.toggle(
        "error",
        Boolean(error)
    );


    toast.classList.add(
        "show"
    );


    setTimeout(
        function () {

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}
