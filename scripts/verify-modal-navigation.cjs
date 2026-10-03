// Exercise actual navigation functions without storage, authentication or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
const ids = ['dashboardMonthModal', 'colourModal', 'expenseAnalysisModal', 'expenseCategoryModal', 'transactionModal', 'transactionViewModal', 'budgetModal', 'guestImportModal'];
const elements = {};
function element(id) {
    return elements[id] ||= {
        dataset: {}, inert: false, style: { removeProperty() {}, setProperty() {} },
        classList: (() => { const classes = new Set(['hidden']); return { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle() {} }; })(),
        reset() {}, focus() {}, blur() {},
    };
}
const state = { currentPage: 'dashboard', currentType: 'expense', activeModal: null, transactions: [{ id: 'income', type: 'income' }, { id: 'expense', type: 'expense' }] };
const originalData = JSON.stringify(state.transactions);
let stack = [{ expenseTracker: true, page: 'dashboard', modal: null }], index = 0;
const listeners = {};
const history = {
    get state() { return stack[index]; },
    pushState(entry) { stack = stack.slice(0, ++index); stack.push(entry); },
    replaceState(entry) { stack[index] = entry; },
    back() { if (index) { index--; context.restoreModalFromHistory(stack[index]); } },
};
let nativeBack, exits = 0;
const context = vm.createContext({ state, history, console, Set,
    document: { getElementById: element, querySelectorAll: () => [], activeElement: element('focus'), body: element('body'), documentElement: element('root'), addEventListener() {} },
    window: { location: { href: 'test://app' }, Capacitor: { getPlatform: () => 'android' }, addEventListener: (name, fn) => listeners[name] = fn },
    getNativePlugin: () => ({ addListener(name, fn) { if (name === 'backButton') nativeBack = fn; }, exitApp() { exits++; } }),
    closeSidebarMenu() {}, stopTransactionModalViewport() {}, setTransactionSubmitting() {}, setTransactionType(type) { state.currentType = type; },
    renderExpenseAnalysis() {}, renderExpenseCategory() {},
    showPage(page) { state.currentPage = page; },
    displayTransactionModal(type, transaction) { state.currentType = type; state.editingTransactionId = transaction?.id || null; state.activeModal = 'transaction'; element('transactionModal').classList.remove('hidden'); element('body').classList.add('modal-open'); },
    displayTransactionView(transaction) { state.activeModal = 'view'; element('transactionViewModal').classList.remove('hidden'); element('body').classList.add('modal-open'); element('transactionViewModal').dataset.id = transaction.id; },
});
vm.runInContext('let modalSession = 0; const retiredModalSessions = new Set();', context);
for (const name of ['clearModalDisplay', 'dismissActiveModalForNavigation', 'prepareModalSwitch', 'createHistoryState', 'navigateToPage', 'setupHistoryNavigation', 'restoreModalFromHistory', 'showExpenseAnalysis', 'showExpenseCategory', 'closeExpenseAnalysis', 'hideExpenseAnalysis', 'closeExpenseCategory', 'hideExpenseCategory', 'openTransactionView', 'openTransactionModal', 'closeTransactionView', 'hideTransactionView', 'closeTransactionModal', 'hideTransactionModal', 'closeBudgetModal', 'hideBudgetModal', 'hideAppearanceModal', 'setupNativeShell']) {
    const start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
}
function visible(expected) {
    assert.deepEqual(ids.filter(id => !element(id).classList.contains('hidden')), expected ? [expected] : []);
}
context.setupHistoryNavigation(); context.setupNativeShell();
context.showExpenseAnalysis(); visible('expenseAnalysisModal');
context.showExpenseAnalysis({ type: 'income' }); visible('expenseAnalysisModal');
assert.equal(state.analysisType, 'income'); context.closeExpenseAnalysis(); visible();
history.back(); visible(); // Retired Expense Analysis must not return.
context.showExpenseAnalysis(); context.showExpenseCategory('Food'); visible('expenseCategoryModal');
context.showExpenseCategory('Travel'); visible('expenseCategoryModal');
nativeBack(); visible('expenseAnalysisModal'); assert.equal(element('expenseAnalysisModal').inert, false);
context.showExpenseCategory('Food'); context.openTransactionView(state.transactions[0]); visible('transactionViewModal');
context.closeTransactionView(); visible(); history.back(); visible();
context.openTransactionView(state.transactions[0]); context.openTransactionView(state.transactions[1]); visible('transactionViewModal');
context.closeTransactionView(); visible();
context.openTransactionView(state.transactions[0]); context.openTransactionModal('income', state.transactions[0]); visible('transactionModal');
nativeBack(); visible('transactionViewModal'); nativeBack(); visible();
context.openTransactionModal('income'); context.openTransactionModal('expense'); visible('transactionModal');
assert.equal(state.currentType, 'expense'); nativeBack(); visible();
for (const id of ids) {
    context.prepareModalSwitch(); element(id).classList.remove('hidden'); state.activeModal = id;
    history.pushState(context.createHistoryState('dashboard', id));
    context.navigateToPage('settings'); visible(); assert.equal(state.currentPage, 'settings');
    assert.equal(state.activeModal, null); assert.equal(element('body').classList.contains('modal-open'), false);
    assert.equal(element('expenseCategoryModal').dataset.category, undefined);
}
// Also recover existing accidental stacks, not just correctly tracked windows.
ids.forEach(id => element(id).classList.remove('hidden'));
context.navigateToPage('budget'); visible();
context.showExpenseAnalysis(); nativeBack(); visible(); assert.equal(exits, 0);
assert.equal(JSON.stringify(state.transactions), originalData);
console.log('PASS: analysis/detail replacement, category Back and sibling replacement, edit Back, all modal-to-bottom-navigation transitions, stale-history suppression, one overlay, Android Back handler, unchanged transaction data.');
