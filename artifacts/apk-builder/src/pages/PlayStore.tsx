import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, CheckCircle2, Circle, AlertTriangle, Star, Globe, FileText, Image, Smartphone } from "lucide-react";

const CHECKLIST = [
  { id: "aab", label: "App Bundle (AAB) generated", category: "build", required: true },
  { id: "keystore", label: "Signed with release keystore", category: "build", required: true },
  { id: "versionCode", label: "Version code incremented", category: "build", required: true },
  { id: "minSdk", label: "Min SDK 21 or higher", category: "build", required: true },
  { id: "title", label: "Store listing title (30 chars max)", category: "listing", required: true },
  { id: "description", label: "Full description (4000 chars max)", category: "listing", required: true },
  { id: "shortDesc", label: "Short description (80 chars max)", category: "listing", required: true },
  { id: "icon", label: "High-res icon (512x512 PNG)", category: "assets", required: true },
  { id: "featureGraphic", label: "Feature graphic (1024x500 PNG)", category: "assets", required: true },
  { id: "screenshots", label: "Screenshots (minimum 2)", category: "assets", required: true },
  { id: "privacyPolicy", label: "Privacy policy URL", category: "legal", required: true },
  { id: "contentRating", label: "Content rating completed", category: "legal", required: false },
  { id: "targetAudience", label: "Target audience configured", category: "legal", required: false },
  { id: "category", label: "App category selected", category: "listing", required: false },
];

const CATEGORIES = [
  "Art & Design", "Auto & Vehicles", "Beauty", "Books & Reference", "Business",
  "Comics", "Communication", "Dating", "Education", "Entertainment",
  "Finance", "Food & Drink", "Health & Fitness", "House & Home", "Libraries & Demo",
  "Lifestyle", "Maps & Navigation", "Medical", "Music & Audio", "News & Magazines",
  "Parenting", "Personalization", "Photography", "Productivity", "Shopping",
  "Social", "Sports", "Tools", "Travel & Local", "Video Players & Editors",
  "Weather",
];

export default function PlayStore() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "",
    shortDesc: "",
    description: "",
    category: "",
    website: "",
    email: "",
    privacyPolicy: "",
  });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const requiredItems = CHECKLIST.filter((c) => c.required);
  const checkedRequired = requiredItems.filter((c) => checked.has(c.id)).length;
  const readiness = Math.round((checkedRequired / requiredItems.length) * 100);

  const categories = ["build", "listing", "assets", "legal"] as const;
  const categoryLabels: Record<string, string> = {
    build: "Build Requirements",
    listing: "Store Listing",
    assets: "Creative Assets",
    legal: "Legal & Policies",
  };
  const categoryIcons: Record<string, React.ElementType> = {
    build: Smartphone,
    listing: FileText,
    assets: Image,
    legal: Globe,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Play Store Preparation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Get your app ready for Google Play Store submission</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Readiness Score</h2>
          <div className={`text-2xl font-bold ${readiness === 100 ? "text-green-400" : readiness >= 60 ? "text-yellow-400" : "text-red-400"}`}>
            {readiness}%
          </div>
        </div>
        <div className="w-full bg-secondary rounded-full h-2.5">
          <motion.div
            className={`h-full rounded-full ${readiness === 100 ? "bg-green-500" : readiness >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${readiness}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {checkedRequired}/{requiredItems.length} required items completed
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat];
          const items = CHECKLIST.filter((c) => c.category === cat);
          const done = items.filter((c) => checked.has(c.id)).length;
          return (
            <div key={cat} className="bg-card border border-card-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {categoryLabels[cat]}
                </h3>
                <span className="text-xs text-muted-foreground">{done}/{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className="flex-shrink-0"
                    >
                      {checked.has(item.id) ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </button>
                    <span className={`text-xs ${checked.has(item.id) ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.label}
                      {item.required && !checked.has(item.id) && (
                        <span className="ml-1 text-red-400">*</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" /> Store Listing Details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">App Title * (max 30 chars)</label>
            <input
              type="text"
              maxLength={30}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="My Awesome App"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.title.length}/30</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Short Description * (max 80 chars)</label>
            <input
              type="text"
              maxLength={80}
              value={form.shortDesc}
              onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))}
              placeholder="A brief description of your app"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.shortDesc.length}/80</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Full Description * (max 4000 chars)</label>
            <textarea
              maxLength={4000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detailed description of your app's features and benefits..."
              rows={5}
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.description.length}/4000</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Privacy Policy URL *</label>
              <input
                type="url"
                value={form.privacyPolicy}
                onChange={(e) => setForm((f) => ({ ...f, privacyPolicy: e.target.value }))}
                placeholder="https://example.com/privacy"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Developer Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Support Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="support@example.com"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {readiness < 100 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Complete all required checklist items before submitting to Play Store
          </div>
        )}
        {readiness === 100 && (
          <button className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <UploadCloud className="w-4 h-4" /> Prepare for Play Store Upload
          </button>
        )}
      </div>
    </div>
  );
}
