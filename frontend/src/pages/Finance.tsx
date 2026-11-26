import { useEffect, useState, type FormEvent } from 'react';
import { financeService } from '../services/financeService';
import api from '../services/api';

export default function Finance() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [receiptFor, setReceiptFor] = useState<any>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [form, setForm] = useState({
    clientId: '',
    dueDate: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 18
  });

  const load = async () => setInvoices(await financeService.getInvoices());

  useEffect(() => {
    void load();
    api.get('/clients').then(response => setClients(response.data)).catch(console.error);
  }, []);

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    await financeService.createInvoice({
      clientId: Number(form.clientId),
      dueDate: new Date(form.dueDate).toISOString(),
      items: [{
        description: form.description,
        quantity: form.quantity,
        unitPrice: form.unitPrice,
        taxRate: form.taxRate
      }]
    });
    setShowCreate(false);
    await load();
  };

  const printInvoice = (invoice: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const outstanding = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    printWindow.document.write(
      `<html><body><h1>Invoice ${invoice.invoiceNumber}</h1>` +
      `<p>Client: ${invoice.client?.name || ''}</p>` +
      `<p>Total: ₹${Number(invoice.totalAmount).toLocaleString('en-IN')}</p>` +
      `<p>Paid: ₹${Number(invoice.amountPaid).toLocaleString('en-IN')}</p>` +
      `<p>Outstanding: ₹${outstanding.toLocaleString('en-IN')}</p>` +
      `</body></html>`
    );
    printWindow.document.close();
    printWindow.print();
  };

  const saveReceipt = async () => {
    if (!receiptFor) return;
    await financeService.addReceipt(receiptFor.id, { amount: Number(receiptAmount) });
    setReceiptFor(null);
    setReceiptAmount('');
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-gray-500">GST invoices and receipt balances.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-black text-white px-4 py-2 rounded-lg">
          New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Invoice</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Paid</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(invoice => (
              <tr key={invoice.id} className="border-t">
                <td className="p-3 font-medium">{invoice.invoiceNumber}</td>
                <td className="p-3">{invoice.client?.name}</td>
                <td className="p-3">₹{Number(invoice.totalAmount).toLocaleString('en-IN')}</td>
                <td className="p-3">₹{Number(invoice.amountPaid).toLocaleString('en-IN')}</td>
                <td className="p-3">{invoice.status}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    {invoice.status === 'Draft' && (
                      <button
                        onClick={async () => {
                          await financeService.issueInvoice(invoice.id);
                          await load();
                        }}
                        className="text-indigo-600"
                      >
                        Issue
                      </button>
                    )}
                    {['Issued', 'PartiallyPaid', 'Overdue'].includes(invoice.status) && (
                      <button onClick={() => setReceiptFor(invoice)} className="text-green-600">
                        Record Receipt
                      </button>
                    )}
                    <button onClick={() => printInvoice(invoice)} className="text-gray-700">
                      PDF / Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receiptFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-3">
            <h2 className="font-bold">Record Receipt - {receiptFor.invoiceNumber}</h2>
            <p className="text-sm text-gray-500">
              Outstanding: ₹{(Number(receiptFor.totalAmount) - Number(receiptFor.amountPaid)).toLocaleString('en-IN')}
            </p>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="w-full border p-2 rounded"
              placeholder="Amount"
              value={receiptAmount}
              onChange={event => setReceiptAmount(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setReceiptFor(null); setReceiptAmount(''); }}
                className="flex-1 border p-2 rounded"
              >
                Cancel
              </button>
              <button onClick={saveReceipt} className="flex-1 bg-green-600 text-white p-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={createInvoice} className="bg-white p-6 rounded-xl w-full max-w-lg space-y-3">
            <h2 className="font-bold text-lg">Create Invoice</h2>
            <select
              required
              className="w-full border p-2 rounded"
              value={form.clientId}
              onChange={event => setForm({ ...form, clientId: event.target.value })}
            >
              <option value="">Client</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <input
              required
              type="datetime-local"
              className="w-full border p-2 rounded"
              value={form.dueDate}
              onChange={event => setForm({ ...form, dueDate: event.target.value })}
            />
            <input
              required
              placeholder="Line item"
              className="w-full border p-2 rounded"
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min="1" className="border p-2 rounded" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} />
              <input type="number" min="0" className="border p-2 rounded" placeholder="Unit price" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: Number(event.target.value) })} />
              <input type="number" min="0" className="border p-2 rounded" placeholder="Tax %" value={form.taxRate} onChange={event => setForm({ ...form, taxRate: Number(event.target.value) })} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border p-2 rounded">Cancel</button>
              <button className="flex-1 bg-indigo-600 text-white p-2 rounded">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
