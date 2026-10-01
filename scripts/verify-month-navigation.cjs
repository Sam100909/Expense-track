// Isolated regression checks: no browser storage, accounts, or remote services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const listeners = {}, elements = {};
const element = id => elements[id] ||= { value: '', innerHTML: '', textContent: '', classList: { contains: () => true, toggle() {}, add() {}, remove() {} }, setAttribute() {}, querySelector: () => ({ textContent: '' }) };
const state = { selectedMonth: '2026-12', transactionMonth: '2026-09', selectedDate: '2026-12-31', currentPage: 'dashboard', analysisType: 'expense', transactions: [
    { id:'a', date:'2026-12-01', type:'income', category:'Other', amount:100 },
    { id:'b', date:'2026-12-20', type:'income', category:'Other', amount:50 },
    { id:'c', date:'2026-12-21', type:'expense', category:'Other', amount:40 },
    { id:'d', date:'2027-01-01', type:'income', category:'Salary', amount:500 },
    { id:'e', date:'2026-09-02', type:'income', category:'Salary', amount:200, note:'match' }
] };
let navigations = [], monthChanges = [], modal = false;
const context = vm.createContext({ state, console, Date, Number, String, Object, Array, Math,
    getLocale: () => 'en-GB', t:x=>x, escapeHTML:x=>x, getCategoryDisplayName:x=>x, getCategoryColor:()=> '#000', formatCurrency:x=>String(x),
    loadBudget() {}, updateAll() {}, window:{innerWidth:360},
    navigateToPage: page=>{ navigations.push(page); state.currentPage=page; },
    getComputedStyle:()=>({overflowX:'visible'}),
    document: { getElementById:element, querySelector:selector=>selector === '#analysisIncomeButton span' ? element('incomeLabel') : modal ? {} : null,
        querySelectorAll:()=>['dashboard','transactions','budget','settings'].map(page=>({dataset:{page}})),
        body:{classList:{contains:()=>modal}}, addEventListener:(name,fn)=>listeners[name]=fn }
});
for (const name of ['getMonthKey','getDateKey','monthLabel','isInSelectedMonth','getSelectedMonthTransactions','sortTransactionsNewestFirst','getIncome','getExpenses','getAllTimeBalance','updateMonthUI','isValidMonth','setSelectedMonth','shiftDashboardMonth','getSelectedMonthExpenseBreakdown','renderExpenseCategory','renderExpenseAnalysis','renderAllTransactions','setupPageSwipes']) {
    const start = source.indexOf('function '+name+'(');
    assert(start >= 0, name);
    const end = source.indexOf('\n}', start)+2;
    vm.runInContext(source.slice(start,end),context);
}
assert.equal(context.getIncome(),150); assert.equal(context.getExpenses(),40);
assert.equal(context.getSelectedMonthExpenseBreakdown('income').entries[0][1],150);
const balance = context.getAllTimeBalance();
context.shiftDashboardMonth(1); assert.equal(state.selectedMonth,'2027-01'); assert.equal(context.getIncome(),500);
context.shiftDashboardMonth(-1); assert.equal(state.selectedMonth,'2026-12');
context.setSelectedMonth('2027-02'); assert.equal(state.selectedDate,'2027-02-28');
assert.equal(context.getAllTimeBalance(),balance); assert.equal(state.transactionMonth,'2026-09');
context.setSelectedMonth('2026-13'); assert.equal(state.selectedMonth,'2027-02');
element('expenseCategoryModal').dataset={category:'Other'};
context.setSelectedMonth('2026-12'); state.analysisType='income'; context.renderExpenseCategory();
assert.equal(element('expenseCategoryTotal').textContent,'150');
assert(element('expenseCategoryTransactions').innerHTML.indexOf('2026-12-20') < element('expenseCategoryTransactions').innerHTML.indexOf('2026-12-01'));
assert(!element('expenseCategoryTransactions').innerHTML.includes('2026-12-21'));
context.setSelectedMonth('2028-01'); context.renderExpenseAnalysis();
assert.equal(element('expenseAnalysisTotal').textContent,'0'); assert.equal(element('expenseAnalysisList').innerHTML,'');
assert(!element('expenseAnalysisList').innerHTML.includes('NaN'));
// Exercise all transaction filters together without needing to construct rows.
element('searchInput').value='match'; element('typeFilter').value='expense'; element('categoryFilter').value='Salary';
context.renderAllTransactions(); assert(element('allTransactions').innerHTML.includes('September 2026'));
assert.equal((html.match(/id="searchInput"/g)||[]).length,1); assert(!html.includes('id="dateFilter"'));
assert(html.indexOf('id="transactionAdvancedFilters"') < html.indexOf('id="searchInput"'));
context.setupPageSwipes();
const target = kind=>({classList:{contains:()=>true}, closest:selector=>selector==='.page' ? {} : selector==='#dashboardMonthHeader' ? (kind==='month' ? {} : null) : kind==='control' ? {} : null });
function swipe(kind,dx,dy=0,x=180) {
    const t=target(kind); listeners.touchstart({touches:[{clientX:x,clientY:150}],target:t});
    listeners.touchmove({touches:[{clientX:x+dx,clientY:150+dy}],cancelable:true,preventDefault(){}});
    listeners.touchend({changedTouches:[{clientX:x+dx,clientY:150+dy}]});
}
swipe('page',-90); assert.equal(state.currentPage,'transactions');
const before=state.selectedMonth; swipe('month',-90); assert.equal(state.currentPage,'transactions'); assert.notEqual(state.selectedMonth,before);
swipe('page',90,120); assert.equal(state.currentPage,'transactions');
swipe('control',90); assert.equal(state.currentPage,'transactions');
swipe('page',90,0,10); assert.equal(state.currentPage,'transactions');
modal=true; swipe('page',90); assert.equal(state.currentPage,'transactions'); modal=false;
state.currentPage='dashboard'; swipe('page',90); assert.equal(state.currentPage,'dashboard');
state.currentPage='settings'; swipe('page',-90); assert.equal(state.currentPage,'settings');
let prevented=false; listeners.click({detail:1,preventDefault(){prevented=true;},stopImmediatePropagation(){}}); assert(prevented);
console.log('PASS: month rollover, income/expense separation, newest-first details, zero income, cumulative balance, filter structure, swipe ownership, exclusions, boundaries, click suppression.');
