import { useState } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import { formatNaira } from '../lib/constants';

function Section({ title, description, children }) {
  return (
    <Card>
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

export function Settings() {
  const { user } = useAppStore();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-5">
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium text-emerald-800">
          ✓ Changes saved successfully.
        </div>
      )}

      {/* Profile */}
      <Section title="Company Profile" description="Your business identity on Ventryl.">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#0A2540] flex items-center justify-center text-white text-xl font-bold">
            {user.avatarInitials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-400">{user.company}</p>
            <div className="flex items-center gap-2 mt-1">
              {user.verified ? (
                <Badge color="green">✓ Verified</Badge>
              ) : (
                <Badge color="yellow">Pending Verification</Badge>
              )}
              <Badge color="blue" className="capitalize">{user.role}</Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name" defaultValue={user.name} />
          <Input label="Phone" defaultValue={user.phone} />
          <Input label="Email" defaultValue={user.email} />
          <Input label="CAC Number" defaultValue={user.cacNumber} disabled hint="Contact support to update" />
          <Input label="Company Name" defaultValue={user.company} className="col-span-2" />
          <Input label="State" defaultValue={user.state} />
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave}>Save Profile</Button>
        </div>
      </Section>

      {/* Wallet */}
      <Section title="Wallet & Billing" description="Manage your Ventryl wallet and payment methods.">
        <div className="bg-[#0A2540] rounded-xl p-5 mb-4">
          <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Available Balance</p>
          <p className="text-3xl font-bold text-white">{formatNaira(user.walletBalance)}</p>
          <p className="text-xs text-white/40 mt-1">Escrow-protected funds</p>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1">Fund Wallet</Button>
          <Button variant="outline" className="flex-1">Withdraw</Button>
          <Button variant="ghost" className="flex-1">Transaction History</Button>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" description="Choose what you hear about.">
        <div className="space-y-3">
          {[
            { label: 'New listings matching my filters', sub: 'Get alerts when new fuel is posted', checked: true },
            { label: 'Order status updates', sub: 'Confirmed, loading, in transit, delivered', checked: true },
            { label: 'Price movement alerts', sub: 'When prices move > 2% in your watchlisted products', checked: true },
            { label: 'Depot announcements', sub: 'Updates from depots you\'ve traded with', checked: false },
            { label: 'Weekly market digest', sub: 'Summary email every Monday', checked: true },
          ].map(({ label, sub, checked }) => (
            <label key={label} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                defaultChecked={checked}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#0A2540] focus:ring-[#0A2540]"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={handleSave}>Save Preferences</Button>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" description="Keep your account secure.">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Password</p>
              <p className="text-xs text-gray-400">Last changed 45 days ago</p>
            </div>
            <Button variant="outline" size="sm">Change</Button>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-xs text-gray-400">Add an extra layer of security via SMS or app</p>
            </div>
            <Badge color="gray">Disabled</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Active Sessions</p>
              <p className="text-xs text-gray-400">1 active session (this device)</p>
            </div>
            <Button variant="ghost" size="sm">Manage</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
