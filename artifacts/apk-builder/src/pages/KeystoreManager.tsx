import { useState } from "react";
import { motion } from "framer-motion";
import { useGetKeystore, useCreateKeystore } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetKeystoreQueryKey } from "@workspace/api-client-react";
import { Key, Shield, Calendar, Building2, Globe, Lock, AlertCircle, CheckCircle } from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : "bg-border"}`} />
        ))}
      </div>
      {password && <p className="text-xs text-muted-foreground">{labels[score]}</p>}
    </div>
  );
}

export default function KeystoreManager() {
  const queryClient = useQueryClient();
  const { data: keystore, isLoading, error } = useGetKeystore();
  const createKeystore = useCreateKeystore();

  const [form, setForm] = useState({
    alias: "release-key",
    password: "",
    confirmPassword: "",
    commonName: "",
    organization: "",
    country: "US",
    validityYears: 25,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.password !== form.confirmPassword) { setFormError("Passwords do not match"); return; }
    if (form.password.length < 6) { setFormError("Password must be at least 6 characters"); return; }
    if (!form.commonName.trim()) { setFormError("Common name is required"); return; }

    await createKeystore.mutateAsync({
      data: {
        alias: form.alias,
        password: form.password,
        commonName: form.commonName,
        organization: form.organization || null,
        country: form.country,
        validityYears: form.validityYears,
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetKeystoreQueryKey() });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Keystore Manager</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your Android signing keystore</p>
      </div>

      {isLoading ? (
        <div className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-32" />
      ) : keystore && !error ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/20">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Active Keystore</h2>
              <p className="text-xs text-muted-foreground">Ready for signing</p>
            </div>
            <CheckCircle className="ml-auto w-5 h-5 text-green-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { label: "Alias", value: keystore.alias, icon: Key },
              { label: "Common Name", value: keystore.commonName, icon: Building2 },
              { label: "Validity", value: `${keystore.validityYears} years`, icon: Calendar },
              { label: "Expires", value: new Date(keystore.expiresAt).toLocaleDateString(), icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-sm text-foreground">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">No keystore found</p>
            <p className="text-xs text-muted-foreground">Generate one below to enable release signing</p>
          </div>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" /> Generate New Keystore
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Key Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Common Name *</label>
              <input
                type="text"
                value={form.commonName}
                onChange={(e) => setForm((f) => ({ ...f, commonName: e.target.value }))}
                placeholder="John Doe"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
              <Lock className="inline w-3 h-3 mr-1" />Password *
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 6 characters"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2"
            />
            <PasswordStrength password={form.password} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Confirm Password *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Organization</label>
              <input
                type="text"
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                placeholder="My Company"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                <Globe className="inline w-3 h-3 mr-1" />Country
              </label>
              <input
                type="text"
                value={form.country}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Validity (years)</label>
              <input
                type="number"
                value={form.validityYears}
                min={1}
                max={100}
                onChange={(e) => setForm((f) => ({ ...f, validityYears: parseInt(e.target.value) || 25 }))}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={createKeystore.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Shield className="w-4 h-4" />
            {createKeystore.isPending ? "Generating..." : "Generate Keystore"}
          </button>
        </form>
      </div>
    </div>
  );
}
