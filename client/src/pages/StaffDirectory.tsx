import { useState } from "react";
import { Layout } from "@/components/Layout";
import { staffDirectory } from "@/lib/mockData";
import { Search, Phone, Mail, Linkedin, Users } from "lucide-react";

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "Family Office": { color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)" },
  Advisory:        { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)" },
  Legal:           { color: "#A855F7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)" },
  Tax:             { color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)" },
  Specialist:      { color: "#FF8C00", bg: "rgba(255,140,0,0.08)", border: "rgba(255,140,0,0.2)" },
};

const CATEGORIES = ["All", "Family Office", "Advisory", "Legal", "Tax", "Specialist"];

export default function StaffDirectory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = staffDirectory.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.firm.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || s.category === category;
    return matchSearch && matchCat;
  });

  const grouped = CATEGORIES.filter(c => c !== "All").reduce((acc, cat) => {
    const members = filtered.filter(s => s.category === cat);
    if (members.length > 0) acc[cat] = members;
    return acc;
  }, {} as Record<string, typeof staffDirectory>);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Staff & Advisor Directory
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Family office team, wealth advisors, legal, tax, and specialist contacts</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {CATEGORIES.filter(c => c !== "All").map((cat) => {
          const cs = CATEGORY_COLORS[cat];
          const count = staffDirectory.filter(s => s.category === cat).length;
          return (
            <div key={cat} className="metric-card text-center py-3" style={{ borderTop: `2px solid ${cs.color}` }}
              data-testid={`card-staff-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-xl font-bold" style={{ color: cs.color, fontFamily: "var(--font-display)" }}>{count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{cat}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(130,150,200,0.4)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or firm…"
            className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl"
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#0F172A" }}
            data-testid="input-staff-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const cs = cat !== "All" ? CATEGORY_COLORS[cat] : null;
            return (
              <button key={cat} onClick={() => setCategory(cat)}
                className="text-xs px-3 py-2 rounded-xl font-medium transition-all"
                style={{
                  background: category === cat ? (cs?.bg || "rgba(0,168,255,0.1)") : "#ffffff",
                  border: `1px solid ${category === cat ? (cs?.border || "rgba(0,168,255,0.25)") : "#f1f5f9"}`,
                  color: category === cat ? (cs?.color || "#00A8FF") : "rgba(150,170,210,0.5)",
                }}
                data-testid={`filter-staff-${cat.toLowerCase().replace(/\s+/g,"-")}`}
              >{cat}</button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6" data-testid="list-staff">
        {Object.entries(grouped).map(([cat, members]) => {
          const cs = CATEGORY_COLORS[cat];
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                  {cat}
                </span>
                <div className="h-px flex-1" style={{ background: "#f8fafc" }} />
                <span className="text-[10px] text-muted-foreground">{members.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {members.map((person) => {
                  const pcs = CATEGORY_COLORS[person.category];
                  return (
                    <div key={person.id}
                      className="metric-card transition-all duration-200"
                      style={{ cursor: "default" }}
                      data-testid={`card-person-${person.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: `${person.color}12`, border: `1px solid ${person.color}25`, color: person.color }}>
                          {person.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-sm text-[var(--kiq-ink)] truncate">{person.name}</p>
                            {person.linkedin && <Linkedin size={11} style={{ color: "#0077B5", flexShrink: 0 }} />}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{person.title}</p>
                          <p className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: pcs.color }}>{person.firm}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Since {person.since}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 flex items-center gap-4" style={{ borderTop: "1px solid #f8fafc" }}>
                        <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity"
                          style={{ color: "rgba(150,170,210,0.6)" }}
                          data-testid={`phone-${person.id}`}>
                          <Phone size={9} />{person.phone}
                        </a>
                        <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity"
                          style={{ color: "rgba(0,168,255,0.6)" }}
                          data-testid={`email-${person.id}`}>
                          <Mail size={9} />{person.email.split("@")[0]}@…
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="metric-card flex items-center justify-center py-12">
            <div className="text-center">
              <Users size={28} style={{ color: "rgba(0,168,255,0.2)", margin: "0 auto 10px" }} />
              <p className="text-xs text-muted-foreground">No contacts match your search</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
