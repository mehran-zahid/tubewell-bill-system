import React, { useState, useEffect } from 'react';
import { getAllGeneratedBills } from '../services/billingService';
import { getAllFundExpenses, addFundExpense, deleteFundExpense } from '../services/fundService';
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Calendar, FileText, Loader2, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonBillingList } from '../components/Skeleton';

export default function FundTab() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  
  // Add Expense form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Delete modal state
  const [deleteId, setDeleteId] = useState(null);
  
  const { showToast } = useToast();

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const bills = await getAllGeneratedBills();
      const expenses = await getAllFundExpenses();
      
      let totalIncome = 0;
      let totalExpense = 0;
      const combinedTransactions = [];

      // Process bills for surplus income
      bills.forEach(bill => {
        let surplus = 0;
        
        if (bill.billingResult && bill.billingResult.totalSurplus !== undefined) {
          surplus = bill.billingResult.totalSurplus;
        } else if (bill.billingResult && bill.billingResult.grandTotalBilled) {
          // Retroactive calculation for older bills
          const actualWapda = parseFloat(bill.wapdaBill) || 0;
          const totalFixed = parseFloat(bill.billingResult.totalFixedExpenses) || 0;
          const grandTotal = parseFloat(bill.billingResult.grandTotalBilled) || 0;
          
          const diff = grandTotal - (actualWapda + totalFixed);
          if (diff > 0) {
            surplus = diff;
          }
        }

        if (surplus > 0) {
          totalIncome += surplus;
          combinedTransactions.push({
            id: `income_${bill.id}`,
            type: 'income',
            amount: surplus,
            title: `Surplus from ${bill.billingTitle || 'Bill'}`,
            date: bill.createdAt ? new Date(bill.createdAt.seconds * 1000).toISOString().split('T')[0] : (bill.endDate || ''),
            createdAt: bill.createdAt ? bill.createdAt.seconds * 1000 : 0
          });
        }
      });

      // Process manual expenses
      expenses.forEach(exp => {
        const amount = parseFloat(exp.amount) || 0;
        totalExpense += amount;
        combinedTransactions.push({
          id: exp.id,
          type: 'expense',
          amount: amount,
          title: exp.title,
          date: exp.date,
          createdAt: exp.createdAt ? exp.createdAt.seconds * 1000 : 0
        });
      });

      // Sort by date (newest first), use exact creation time as tie-breaker for same day
      combinedTransactions.sort((a, b) => {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        
        if (timeA === timeB) {
          return b.createdAt - a.createdAt; // Tie-breaker for same day
        }
        return timeB - timeA;
      });

      setSummary({
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense
      });
      setTransactions(combinedTransactions);
    } catch (error) {
      console.error("Error fetching fund data:", error);
      showToast("Failed to load fund data.", "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.date) {
      showToast("Please fill all required fields.", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newExpense = await addFundExpense(expenseForm);
      showToast("Expense logged successfully!", "success");
      setShowAddForm(false);
      setExpenseForm({ title: '', amount: '', date: new Date().toISOString().split('T')[0] });
      
      // Update UI instantly without refetching the database
      const newTx = {
        id: newExpense.id,
        type: 'expense',
        amount: parseFloat(newExpense.amount) || 0,
        title: newExpense.title,
        date: newExpense.date,
        createdAt: newExpense.createdAt ? newExpense.createdAt.seconds * 1000 : Date.now()
      };
      
      setTransactions(prev => {
        const updated = [...prev, newTx];
        updated.sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          if (timeA === timeB) return b.createdAt - a.createdAt;
          return timeB - timeA;
        });
        return updated;
      });
      
      setSummary(prev => ({
        ...prev,
        expense: prev.expense + newTx.amount,
        balance: prev.balance - newTx.amount
      }));
    } catch (error) {
      console.error("Error adding expense:", error);
      showToast("Failed to add expense.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteId) return;
    const txToDelete = transactions.find(t => t.id === deleteId);
    const amountToRestore = txToDelete ? txToDelete.amount : 0;
    
    // Optimistic UI: Remove instantly from screen
    setTransactions(prev => prev.filter(t => t.id !== deleteId));
    if (txToDelete) {
      setSummary(prev => ({
        ...prev,
        expense: prev.expense - amountToRestore,
        balance: prev.balance + amountToRestore
      }));
    }
    
    const idToDelete = deleteId;
    setDeleteId(null);

    try {
      await deleteFundExpense(idToDelete);
      showToast("Expense deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting expense:", error);
      showToast("Failed to delete expense. Reverting.", "error");
      fetchData(false); // Re-fetch to fix UI if the server failed
    }
  };

  if (loading) {
    return (
      <div className="tab-pane active" style={{ padding: '24px' }}>
        <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={24} /> Tubewell Fund
        </h2>
        <SkeletonBillingList />
      </div>
    );
  }

  return (
    <div className="tab-pane active" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header Pattern */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={24} color="var(--primary)" /> 
            Tubewell Fund
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', margin: 0, color: 'var(--text-secondary)' }}>
            Manage surplus collection from rounded bills and log maintenance expenses.
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter', fontSize: '14px', fontWeight: 600 }}
        >
          <Plus size={16} />
          Log Expense
        </button>
      </div>

      {/* Summary Balance */}
      <div style={{ marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', background: 'var(--primary)', color: 'white', border: 'none', boxShadow: '0 10px 25px -5px rgba(var(--primary-rgb), 0.4)', display: 'inline-block', minWidth: '300px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, marginBottom: '8px', fontFamily: 'Inter' }}>Current Available Balance</div>
          <div style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <Wallet size={32} style={{ opacity: 0.8 }} />
            Rs. {summary.balance.toLocaleString()}
          </div>
        </div>
      </div>
      {/* Transaction History */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-canvas)' }}>
          <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction History</h3>
        </div>
        
        {transactions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions.map((tx, idx) => {
              // Calculate Month/Year grouping
              const txDate = new Date(tx.date || tx.createdAt);
              // Handle invalid dates gracefully just in case
              const txMonthYear = isNaN(txDate.getTime()) ? 'Unknown Date' : txDate.toLocaleString('default', { month: 'long', year: 'numeric' });
              
              let showMonthHeader = false;
              if (idx === 0) {
                showMonthHeader = true;
              } else {
                const prevTx = transactions[idx - 1];
                const prevDate = new Date(prevTx.date || prevTx.createdAt);
                const prevMonthYear = isNaN(prevDate.getTime()) ? 'Unknown Date' : prevDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                showMonthHeader = txMonthYear !== prevMonthYear;
              }

              return (
                <React.Fragment key={tx.id}>
                  {showMonthHeader && (
                    <div style={{ 
                      padding: '12px 20px', 
                      background: 'var(--bg-canvas)', 
                      borderBottom: '1px solid var(--border-default)',
                      borderTop: idx !== 0 ? '1px solid var(--border-default)' : 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'Inter',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      {txMonthYear}
                    </div>
                  )}
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: idx !== transactions.length - 1 ? '1px solid var(--border-default)' : 'none',
                      background: 'var(--bg-surface)'
                    }}
                  >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '50%', 
                    background: tx.type === 'income' ? 'var(--success-light)' : 'var(--danger-light)',
                    color: tx.type === 'income' ? 'var(--success-dark)' : 'var(--danger-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {tx.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '16px', fontFamily: 'Inter' }}>{tx.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter', fontWeight: 500 }}>
                      <Calendar size={12} /> {tx.date ? tx.date.split('-').reverse().join('-') : ''}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ 
                    fontFamily: 'Outfit', 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: tx.type === 'income' ? 'var(--success-dark)' : 'var(--text-primary)' 
                  }}>
                    {tx.type === 'income' ? '+' : '-'}Rs. {tx.amount.toLocaleString()}
                  </div>
                  
                  {tx.type === 'expense' ? (
                    <button 
                      onClick={() => setDeleteId(tx.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s ease' }}
                      title="Delete Expense"
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <div style={{ width: '32px' }}></div> // Spacer for alignment
                  )}
                </div>
              </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p style={{ margin: '0 0 8px 0', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'Inter', fontSize: '14px' }}>No transactions found in the fund.</p>
            <p style={{ margin: 0, fontSize: '13px', fontFamily: 'Inter', lineHeight: '1.5' }}>The fund balance automatically updates when you <br/><strong>Publish & Save</strong> a bill with surplus generated from round-ups.</p>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <button 
              onClick={() => setShowAddForm(false)}
              disabled={isSubmitting}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ margin: '0 0 24px 0', fontFamily: 'Outfit', fontSize: '20px', fontWeight: 700 }}>Log Fund Expense</h2>
            
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Expense Title / Description *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({...expenseForm, title: e.target.value})}
                  placeholder="e.g. Minor Motor Repair"
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount (Rs.) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                    placeholder="0"
                    min="1"
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSubmitting && <Loader2 className="spinner" size={16} />}
                  {isSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!deleteId}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete Expense"
      />
    </div>
  );
}
