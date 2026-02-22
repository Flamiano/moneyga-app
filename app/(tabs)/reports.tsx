import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { supabase } from "../../lib/supabase";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  green: "#3A6B55",
  greenLight: "#4E8C71",
  greenMuted: "#E8F2ED",
  coral: "#D48380",
  coralLight: "#FDECEA",
  gold: "#C9A84C",
  goldLight: "#FBF4E3",
  purple: "#7C6FCD",
  purpleLight: "#EDEBFB",
  sky: "#4A9FC7",
  skyLight: "#E8F4FB",
  bg: "#F4F1EC",
  card: "#FFFFFF",
  textDark: "#1A3329",
  textMid: "#4A6357",
  textLight: "#8FA89F",
  border: "#E4DDD5",
};

const PIE_COLORS = [C.green, C.coral, C.gold, C.purple, C.sky, "#E8845A", "#56A0A0"];
const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 64;

interface ReportState {
  income: any[];
  expenses: any[];
  budgets: any[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sh.wrapper}>
      <Text style={sh.title}>{title}</Text>
      {subtitle && <Text style={sh.subtitle}>{subtitle}</Text>}
    </View>
  );
}
const sh = StyleSheet.create({
  wrapper: { marginBottom: 12, marginTop: 28 },
  title: { fontSize: 17, fontWeight: "700", color: C.textDark, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: C.textLight, marginTop: 2 },
});

function KpiChip({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) {
  return (
    <View style={[kpi.chip, { backgroundColor: bg }]}>
      <View style={[kpi.iconWrap, { backgroundColor: color + "20" }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={kpi.label}>{label}</Text>
      <Text style={[kpi.value, { color }]}>{value}</Text>
    </View>
  );
}
const kpi = StyleSheet.create({
  chip: { flex: 1, borderRadius: 20, padding: 16, marginHorizontal: 4, alignItems: "flex-start" },
  iconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  label: { fontSize: 11, color: C.textLight, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "800", marginTop: 3, letterSpacing: -0.5 },
});

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <View style={sr.row}>
      <View style={sr.top}>
        <View style={sr.dot}>
          <View style={[sr.dotInner, { backgroundColor: color }]} />
          <Text style={sr.label}>{label}</Text>
        </View>
        <View style={sr.right}>
          <Text style={sr.pct}>{pct.toFixed(1)}%</Text>
          <Text style={sr.amount}>₱{value.toLocaleString()}</Text>
        </View>
      </View>
      <View style={sr.track}>
        <View style={[sr.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  row: { marginBottom: 14 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dot: { flexDirection: "row", alignItems: "center" },
  dotInner: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  label: { fontSize: 13, fontWeight: "600", color: C.textDark },
  right: { alignItems: "flex-end" },
  pct: { fontSize: 10, color: C.textLight, fontWeight: "600" },
  amount: { fontSize: 13, fontWeight: "700", color: C.textDark },
  track: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

function BudgetItem({ budget, spent }: { budget: any; spent: number }) {
  const limit = Number(budget.amount) || 1;
  const pct = Math.min((spent / limit) * 100, 100);
  const over = spent > limit;
  const barColor = over ? C.coral : pct > 75 ? C.gold : C.green;
  return (
    <View style={bi.wrap}>
      <View style={bi.header}>
        <View style={bi.left}>
          <View style={[bi.badge, { backgroundColor: barColor + "18" }]}>
            <Text style={[bi.badgeText, { color: barColor }]}>{budget.category}</Text>
          </View>
        </View>
        <View style={bi.right}>
          {over && (
            <View style={bi.overTag}>
              <Text style={bi.overText}>Over budget</Text>
            </View>
          )}
          <Text style={bi.amounts}>
            <Text style={{ color: barColor, fontWeight: "700" }}>₱{spent.toLocaleString()}</Text>
            <Text style={bi.limit}> / ₱{limit.toLocaleString()}</Text>
          </Text>
        </View>
      </View>
      <View style={bi.track}>
        <View style={[bi.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={bi.pctLabel}>{pct.toFixed(0)}% used</Text>
    </View>
  );
}
const bi = StyleSheet.create({
  wrap: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  left: { flex: 1 },
  right: { alignItems: "flex-end" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  overTag: { backgroundColor: C.coralLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  overText: { fontSize: 10, color: C.coral, fontWeight: "700" },
  amounts: { fontSize: 14 },
  limit: { color: C.textLight, fontWeight: "500" },
  track: { height: 7, backgroundColor: C.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pctLabel: { marginTop: 5, fontSize: 11, color: C.textLight, fontWeight: "500" },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportState>({ income: [], expenses: [], budgets: [] });

  const fetchData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setLoading(false); return; }
      const [inc, exp, bud] = await Promise.all([
        supabase.from("income").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
        supabase.from("budgets").select("*").eq("user_id", user.id),
      ]);
      setReportData({ income: inc.data ?? [], expenses: exp.data ?? [], budgets: bud.data ?? [] });
    } catch {
      Alert.alert("Error", "Could not load report data.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setLoading(true);
      fetchData();
    }, [])
  );

  const stats = useMemo(() => {
    const totalInc = reportData.income.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalExp = reportData.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const balance = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? (balance / totalInc) * 100 : 0;

    const categoryMap: Record<string, number> = {};
    reportData.expenses.forEach((e) => {
      const cat = e.category || "General";
      categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const pieData = Object.keys(categoryMap).map((key, i) => ({
      name: key,
      population: categoryMap[key],
      color: PIE_COLORS[i % PIE_COLORS.length],
      legendFontColor: C.textMid,
      legendFontSize: 12,
    }));

    const monthlyMap: Record<string, { inc: number; exp: number }> = {};
    const getMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? "N/A" : d.toLocaleString("default", { month: "short" });
    };
    reportData.income.forEach((i) => {
      const m = getMonth(i.created_at || i.date);
      if (!monthlyMap[m]) monthlyMap[m] = { inc: 0, exp: 0 };
      monthlyMap[m].inc += Number(i.amount) || 0;
    });
    reportData.expenses.forEach((e) => {
      const m = getMonth(e.created_at || e.date);
      if (!monthlyMap[m]) monthlyMap[m] = { inc: 0, exp: 0 };
      monthlyMap[m].exp += Number(e.amount) || 0;
    });

    const months = Object.keys(monthlyMap).slice(-6);
    const barLabels = months.length > 0 ? months : ["—"];
    const incData = barLabels.map((m) => monthlyMap[m]?.inc || 0);
    const expData = barLabels.map((m) => monthlyMap[m]?.exp || 0);

    return { totalInc, totalExp, balance, savingsRate, pieData, categoryMap, barLabels, incData, expData };
  }, [reportData]);

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={s.loadText}>Building your report…</Text>
      </View>
    );
  }

  const baseChartConfig = {
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(58, 107, 85, ${opacity})`,
    labelColor: () => C.textLight,
    propsForLabels: { fontSize: 10 },
    propsForBackgroundLines: { stroke: C.border, strokeWidth: 1 },
    barPercentage: 0.6,
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HERO BALANCE CARD ── */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>NET BALANCE</Text>
            <Text style={[s.heroBalance, { color: stats.balance >= 0 ? "#A8D8BF" : "#FFB2AE" }]}>
              {stats.balance < 0 ? "-" : ""}₱{Math.abs(stats.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <View style={[s.heroTag, { backgroundColor: stats.balance >= 0 ? "#A8D8BF25" : "#FFB2AE25" }]}>
              <MaterialCommunityIcons
                name={stats.balance >= 0 ? "trending-up" : "trending-down"}
                size={13}
                color={stats.balance >= 0 ? "#A8D8BF" : "#FFB2AE"}
              />
              <Text style={[s.heroTagText, { color: stats.balance >= 0 ? "#A8D8BF" : "#FFB2AE" }]}>
                {stats.balance >= 0 ? "You're in the green 🎉" : "Spending exceeds income"}
              </Text>
            </View>
          </View>
          <View style={s.savingsRing}>
            <Text style={s.savingsNum}>{Math.max(0, Math.round(stats.savingsRate))}%</Text>
            <Text style={s.savingsLabel}>saved</Text>
          </View>
        </View>

        <View style={s.heroDivider} />

        <View style={s.heroRow}>
          <View style={s.heroStat}>
            <MaterialCommunityIcons name="arrow-up-circle-outline" size={15} color="#A8D8BF" style={{ marginBottom: 3 }} />
            <Text style={s.heroStatLabel}>INCOME</Text>
            <Text style={s.heroStatInc}>₱{stats.totalInc.toLocaleString()}</Text>
          </View>
          <View style={s.heroVDivider} />
          <View style={s.heroStat}>
            <MaterialCommunityIcons name="arrow-down-circle-outline" size={15} color="#FFB2AE" style={{ marginBottom: 3 }} />
            <Text style={s.heroStatLabel}>EXPENSES</Text>
            <Text style={s.heroStatExp}>₱{stats.totalExp.toLocaleString()}</Text>
          </View>
          <View style={s.heroVDivider} />
          <View style={s.heroStat}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={15} color="#ECC94B" style={{ marginBottom: 3 }} />
            <Text style={s.heroStatLabel}>SAVINGS</Text>
            <Text style={s.heroStatSave}>₱{Math.max(0, stats.balance).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* ── KPI CHIPS ── */}
      <View style={s.kpiRow}>
        <KpiChip
          icon="receipt-text-outline"
          label="Transactions"
          value={`${reportData.expenses.length + reportData.income.length}`}
          color={C.green}
          bg={C.greenMuted}
        />
        <KpiChip
          icon="wallet-outline"
          label="Budgets Set"
          value={`${reportData.budgets.length}`}
          color={C.purple}
          bg={C.purpleLight}
        />
      </View>

      {/* ── MONTHLY OVERVIEW ── */}
      <SectionHeader title="Monthly Overview" subtitle="Income vs Expenses by month" />
      <View style={s.card}>
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.green }]} />
            <Text style={s.legendText}>Income</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.coral }]} />
            <Text style={s.legendText}>Expenses</Text>
          </View>
        </View>
        {stats.incData.some(v => v > 0) || stats.expData.some(v => v > 0) ? (
          <LineChart
            data={{
              labels: stats.barLabels,
              datasets: [
                { data: stats.incData.length > 0 ? stats.incData : [0], color: () => C.green, strokeWidth: 2.5 },
                { data: stats.expData.length > 0 ? stats.expData : [0], color: () => C.coral, strokeWidth: 2.5 },
              ],
            }}
            width={CHART_WIDTH}
            height={190}
            chartConfig={{
              ...baseChartConfig,
              fillShadowGradientOpacity: 0.06,
            }}
            bezier
            style={s.chart}
            withDots
            withInnerLines
            withShadow={false}
          />
        ) : (
          <View style={s.empty}>
            <MaterialCommunityIcons name="chart-line" size={40} color={C.border} />
            <Text style={s.emptyText}>Add records to see monthly trends</Text>
          </View>
        )}
      </View>

      {/* ── EXPENSE BAR CHART ── */}
      <SectionHeader title="Expense by Month" subtitle="How much you spent each month" />
      <View style={s.card}>
        {stats.expData.some(v => v > 0) ? (
          <BarChart
            data={{
              labels: stats.barLabels,
              datasets: [{ data: stats.expData }],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={{
              ...baseChartConfig,
              color: (opacity = 1) => `rgba(212, 131, 128, ${opacity})`,
            }}
            style={s.chart}
            showBarTops={false}
            withInnerLines
            fromZero
            yAxisLabel="₱"
            yAxisSuffix=""
          />
        ) : (
          <View style={s.empty}>
            <MaterialCommunityIcons name="chart-bar" size={40} color={C.border} />
            <Text style={s.emptyText}>No expense data available</Text>
          </View>
        )}
      </View>

      {/* ── EXPENSE BREAKDOWN PIE ── */}
      <SectionHeader title="Spending by Category" subtitle="Where your money goes" />
      <View style={s.card}>
        {stats.pieData.length > 0 ? (
          <>
            <PieChart
              data={stats.pieData}
              width={CHART_WIDTH}
              height={200}
              chartConfig={baseChartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="10"
              absolute
            />
            <View style={s.dividerLine} />
            {stats.pieData.map((item) => (
              <StatRow
                key={item.name}
                label={item.name}
                value={item.population}
                total={stats.totalExp}
                color={item.color}
              />
            ))}
          </>
        ) : (
          <View style={s.empty}>
            <MaterialCommunityIcons name="chart-pie" size={40} color={C.border} />
            <Text style={s.emptyText}>No expense data yet</Text>
          </View>
        )}
      </View>

      {/* ── BUDGET TRACKER ── */}
      <SectionHeader title="Budget Tracker" subtitle="Your limits vs actual spending" />
      <View style={s.card}>
        {reportData.budgets.length > 0 ? (
          <>
            <View style={s.budgetSummary}>
              <View style={[s.bsChip, { backgroundColor: C.greenMuted }]}>
                <Text style={[s.bsNum, { color: C.green }]}>
                  {reportData.budgets.filter(b => (stats.categoryMap[b.category] || 0) <= Number(b.amount)).length}
                </Text>
                <Text style={[s.bsLabel, { color: C.green }]}>On Track</Text>
              </View>
              <View style={[s.bsChip, { backgroundColor: C.coralLight }]}>
                <Text style={[s.bsNum, { color: C.coral }]}>
                  {reportData.budgets.filter(b => (stats.categoryMap[b.category] || 0) > Number(b.amount)).length}
                </Text>
                <Text style={[s.bsLabel, { color: C.coral }]}>Over</Text>
              </View>
              <View style={[s.bsChip, { backgroundColor: C.goldLight }]}>
                <Text style={[s.bsNum, { color: C.gold }]}>
                  {reportData.budgets.filter(b => {
                    const p = ((stats.categoryMap[b.category] || 0) / Number(b.amount)) * 100;
                    return p >= 75 && p <= 100;
                  }).length}
                </Text>
                <Text style={[s.bsLabel, { color: C.gold }]}>Near Limit</Text>
              </View>
            </View>
            <View style={s.dividerLine} />
            {reportData.budgets.map((b) => (
              <BudgetItem key={b.id} budget={b} spent={stats.categoryMap[b.category] || 0} />
            ))}
          </>
        ) : (
          <View style={s.empty}>
            <MaterialCommunityIcons name="wallet-plus-outline" size={40} color={C.border} />
            <Text style={s.emptyText}>No budgets set yet.{"\n"}Create one to start tracking!</Text>
          </View>
        )}
      </View>

      {/* Bottom spacer — clears navbar + some breathing room */}
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingTop: 16 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  loadText: { marginTop: 12, color: C.textLight, fontSize: 14, fontWeight: "500" },

  // Hero card
  hero: {
    backgroundColor: C.green,
    borderRadius: 28,
    padding: 24,
    elevation: 8,
    shadowColor: C.green,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  heroLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  heroBalance: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  heroTag: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 5, marginTop: 8 },
  heroTagText: { fontSize: 12, fontWeight: "600" },
  savingsRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  savingsNum: { color: "#fff", fontSize: 22, fontWeight: "800" },
  savingsLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "600" },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 20 },
  heroRow: { flexDirection: "row", justifyContent: "space-around" },
  heroStat: { alignItems: "center", flex: 1 },
  heroStatLabel: { color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "700", letterSpacing: 0.8, marginBottom: 3 },
  heroStatInc: { color: "#A8D8BF", fontSize: 14, fontWeight: "800" },
  heroStatExp: { color: "#FFB2AE", fontSize: 14, fontWeight: "800" },
  heroStatSave: { color: "#ECC94B", fontSize: 14, fontWeight: "800" },
  heroVDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)", marginHorizontal: 8 },

  // KPI chips
  kpiRow: { flexDirection: "row", marginTop: 14, marginHorizontal: -4 },

  // Generic card
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  chart: { borderRadius: 12, marginLeft: -14 },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: C.textLight, fontWeight: "500" },
  dividerLine: { height: 1, backgroundColor: C.border, marginVertical: 16 },

  // Budget summary chips
  budgetSummary: { flexDirection: "row", gap: 10, marginBottom: 4 },
  bsChip: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center" },
  bsNum: { fontSize: 26, fontWeight: "800" },
  bsLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },

  // Empty state
  empty: { alignItems: "center", paddingVertical: 36 },
  emptyText: { marginTop: 12, color: C.textLight, fontSize: 14, textAlign: "center", lineHeight: 22 },
});