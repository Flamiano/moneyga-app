import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import FlashMessage, { showMessage } from "react-native-flash-message";

// Update this path to match your project structure
import { supabase } from "../../lib/supabase";

const screenWidth = Dimensions.get("window").width;
const categories = ["Salary", "Business", "Freelance", "Gift", "Others"];

export default function IncomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const isFocused = useIsFocused();

  // --- Loading States ---
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"Weekly" | "Monthly" | "Yearly">(
    "Monthly"
  );

  // --- Data States ---
  const [rawIncome, setRawIncome] = useState<any[]>([]);
  const [todayIncome, setTodayIncome] = useState(0);
  const [chartData, setChartData] = useState({
    labels: ["Jan"],
    income: [0],
    expenses: [0],
  });
  const [data, setData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    savings: 0,
  });

  // --- Form States ---
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Salary");

  // Smooth Scroll to Top when screen is focused
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, [])
  );

  useEffect(() => {
    if (isFocused) fetchFinancials();
  }, [isFocused, timeFilter]);

  async function fetchFinancials() {
    setLoading(true);
    setFilterLoading(true);
    setBalanceLoading(true);
    setChartLoading(true);
    setTransactionLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      // Fetch Income and Expenses concurrently
      const [incRes, expRes] = await Promise.all([
        supabase
          .from("income")
          .select("*")
          .eq("user_id", session.user.id)
          .order("date", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", session.user.id)
          .order("date", { ascending: false }),
      ]);

      const incomes = incRes.data || [];
      const expenses = expRes.data || [];
      setRawIncome(incomes);

      // Today's calculation
      const today = new Date().toISOString().split("T")[0];
      const todaySum = incomes
        .filter((item) => item.date.split("T")[0] === today)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      setTodayIncome(todaySum);

      // Overall totals
      const totalInc = incomes.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );
      const totalExp = expenses.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );

      setData({
        totalIncome: totalInc,
        totalExpenses: totalExp,
        savings: totalInc - totalExp,
      });

      processChartData(incomes, expenses);

      // Staggered Loading simulation
      setTimeout(() => setFilterLoading(false), 400);
      setTimeout(() => setBalanceLoading(false), 700);
      setTimeout(() => setChartLoading(false), 1000);
      setTimeout(() => setTransactionLoading(false), 1300);
    } catch (error: any) {
      showMessage({ message: error.message, type: "danger" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const processChartData = (incomes: any[], expenses: any[]) => {
    let labels: string[] = [];
    let incValues: number[] = [];
    let expValues: number[] = [];
    const now = new Date();

    if (timeFilter === "Weekly") {
      labels = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"];
      incValues = new Array(7).fill(0);
      expValues = new Array(7).fill(0);
      const filterData = (list: any[], targetArr: number[]) => {
        list.forEach((item) => {
          const itemDate = new Date(item.date);
          const diffDays = Math.floor(
            (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24)
          );
          if (diffDays >= 0 && diffDays < 7)
            targetArr[6 - diffDays] += Number(item.amount);
        });
      };
      filterData(incomes, incValues);
      filterData(expenses, expValues);
    } else if (timeFilter === "Monthly") {
      labels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      incValues = new Array(12).fill(0);
      expValues = new Array(12).fill(0);
      incomes.forEach((i) => {
        const d = new Date(i.date);
        if (d.getFullYear() === now.getFullYear())
          incValues[d.getMonth()] += Number(i.amount);
      });
      expenses.forEach((e) => {
        const d = new Date(e.date);
        if (d.getFullYear() === now.getFullYear())
          expValues[d.getMonth()] += Number(e.amount);
      });
    } else if (timeFilter === "Yearly") {
      const currentYear = now.getFullYear();
      labels = [
        currentYear - 4,
        currentYear - 3,
        currentYear - 2,
        currentYear - 1,
        currentYear,
      ].map(String);
      incValues = new Array(5).fill(0);
      expValues = new Array(5).fill(0);
      incomes.forEach((i) => {
        const year = new Date(i.date).getFullYear();
        const index = labels.indexOf(year.toString());
        if (index !== -1) incValues[index] += Number(i.amount);
      });
      expenses.forEach((e) => {
        const year = new Date(e.date).getFullYear();
        const index = labels.indexOf(year.toString());
        if (index !== -1) expValues[index] += Number(e.amount);
      });
    }
    setChartData({ labels, income: incValues, expenses: expValues });
  };

  const handleAddIncome = async () => {
    if (!title || !amount)
      return Alert.alert("Error", "Please fill in all fields");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("income").insert([
        {
          user_id: user.id,
          title,
          amount: parseFloat(amount),
          category,
          date: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setModalVisible(false);
      setTitle("");
      setAmount("");
      fetchFinancials();
      showMessage({
        message: "Income Added! 💰",
        type: "success",
        backgroundColor: "#3A6B55",
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this income record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("income")
                .delete()
                .eq("id", id);
              if (error) throw error;
              fetchFinancials();
              showMessage({ message: "Income Deleted", type: "info" });
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Salary: "#3A6B55",
      Business: "#F2994A",
      Freelance: "#2D9CDB",
      Gift: "#EB5757",
    };
    return colors[cat] || "#9B51E0";
  };

  const savingsPercent =
    data.totalIncome > 0
      ? ((data.savings / data.totalIncome) * 100).toFixed(1)
      : "0";
  const expensesPercent =
    data.totalIncome > 0
      ? ((data.totalExpenses / data.totalIncome) * 100).toFixed(0)
      : "0";

  return (
    <View style={{ flex: 1, backgroundColor: "#EFEBE4" }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchFinancials}
            tintColor="#3A6B55"
          />
        }
      >
        {/* ENHANCED BALANCE CARD */}
        <View style={styles.mainBalanceCard}>
          {balanceLoading ? (
            <ActivityIndicator color="#fff" style={{ padding: 20 }} />
          ) : (
            <>
              <View style={styles.balanceHeader}>
                <View>
                  <Text style={styles.mainBalanceLabel}>
                    Net Savings (Ipon)
                  </Text>
                  <Text style={styles.mainBalanceValue}>
                    ₱{data.savings.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>
                    {savingsPercent}% Saved
                  </Text>
                </View>
              </View>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (data.savings / (data.totalIncome || 1)) * 100
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.balanceFooter}>
                <Text style={styles.footerText}>
                  Gastos:{" "}
                  <Text style={{ fontWeight: "bold" }}>{expensesPercent}%</Text>
                </Text>
                <Text style={styles.footerText}>
                  Target: <Text style={{ fontWeight: "bold" }}>20%</Text>
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.row}>
          <View style={styles.statBox}>
            <MaterialCommunityIcons
              name="arrow-up-circle"
              size={18}
              color="#3A6B55"
            />
            <Text style={styles.statLabel}>All Income</Text>
            {balanceLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.statIncome}>
                ₱{data.totalIncome.toLocaleString()}
              </Text>
            )}
          </View>
          <View style={styles.statBox}>
            <MaterialCommunityIcons
              name="arrow-down-circle"
              size={18}
              color="#C25450"
            />
            <Text style={styles.statLabel}>Gastos</Text>
            {balanceLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.statExpense}>
                ₱{data.totalExpenses.toLocaleString()}
              </Text>
            )}
          </View>
        </View>

        {/* Today's Income Card */}
        {todayIncome > 0 && (
          <View style={styles.todayCard}>
            <View style={styles.todayInfo}>
              <View style={styles.todayIconContainer}>
                <MaterialCommunityIcons
                  name="calendar-check"
                  size={24}
                  color="#3A6B55"
                />
              </View>
              <View>
                <Text style={styles.todayLabel}>Today's Income</Text>
                <Text style={styles.todayDate}>
                  {new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
            <Text style={styles.todayValue}>
              +₱{todayIncome.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Trend Chart */}
        <View style={styles.chartCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.chartTitle}>Cash Flow Trend</Text>
            <View style={styles.filterRow}>
              {["Weekly", "Monthly", "Yearly"].map((f: any) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setTimeFilter(f)}
                  style={[
                    styles.filterBtn,
                    timeFilter === f && styles.filterBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      timeFilter === f && { color: "#fff" },
                    ]}
                  >
                    {f[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {chartLoading ? (
            <View style={{ height: 180, justifyContent: "center" }}>
              <ActivityIndicator color="#3A6B55" />
            </View>
          ) : (
            <LineChart
              data={{
                labels: chartData.labels,
                datasets: [
                  {
                    data: chartData.income.length > 0 ? chartData.income : [0],
                    color: () => `#3A6B55`,
                  },
                  {
                    data:
                      chartData.expenses.length > 0 ? chartData.expenses : [0],
                    color: () => `#C25450`,
                  },
                ],
                legend: ["Income", "Gastos"],
              }}
              width={screenWidth - 40}
              height={180}
              chartConfig={{
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                decimalPlaces: 0,
                propsForLabels: { fontSize: 10 },
              }}
              bezier
              style={styles.lineChartStyle}
            />
          )}
        </View>

        {/* Recent Income List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Income</Text>
          <TouchableOpacity onPress={() => setHistoryVisible(true)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactionLoading ? (
          <ActivityIndicator color="#3A6B55" />
        ) : (
          rawIncome.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              onLongPress={() => handleDeleteIncome(item.id)}
              activeOpacity={0.7}
              style={[
                styles.iponCard,
                { borderLeftColor: getCategoryColor(item.category) },
              ]}
            >
              <View style={styles.iponInfo}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: getCategoryColor(item.category) + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="wallet-plus-outline"
                    size={20}
                    color={getCategoryColor(item.category)}
                  />
                </View>
                <View>
                  <Text style={styles.iponLabel}>{item.title}</Text>
                  <Text style={styles.iponSubtitle}>
                    {item.category} • {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.iponValue}>
                  +₱{item.amount.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 9, color: "#CCC" }}>
                  Hold to delete
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <MaterialCommunityIcons name="plus" size={32} color="#fff" />
      </TouchableOpacity>

      {/* HISTORY MODAL */}
      <Modal visible={historyVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: "85%" }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Income History</Text>
                <Text style={styles.modalSubtitle}>
                  Showing all records (Latest first)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={30}
                  color="#DDD"
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={rawIncome}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onLongPress={() => handleDeleteIncome(item.id)}
                  style={styles.historyListItem}
                >
                  <View style={styles.historyLeft}>
                    <View
                      style={[
                        styles.iconCircleSmall,
                        {
                          backgroundColor:
                            getCategoryColor(item.category) + "15",
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="cash"
                        size={18}
                        color={getCategoryColor(item.category)}
                      />
                    </View>
                    <View>
                      <Text style={styles.historyItemTitle}>{item.title}</Text>
                      <Text style={styles.historyItemDate}>
                        {new Date(item.date).toDateString()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyItemAmount}>
                    +₱{item.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No records found</Text>
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </Modal>

      {/* ADD INCOME MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Income</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Income Source"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#AAA"
            />
            <TextInput
              style={styles.input}
              placeholder="Amount (₱)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor="#AAA"
            />
            <Text style={styles.inputLabel}>Select Category</Text>
            <View style={styles.categoryPicker}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.catChip,
                    category === cat && {
                      backgroundColor: getCategoryColor(cat),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      category === cat && { color: "#fff" },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddIncome}>
              <Text style={styles.saveBtnText}>Save Income</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlashMessage position="top" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 150 },
  mainBalanceCard: {
    backgroundColor: "#3A6B55",
    padding: 25,
    borderRadius: 28,
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#3A6B55",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainBalanceLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  mainBalanceValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  savingsBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  savingsBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  progressContainer: {
    height: 10,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 10,
    marginTop: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  progressBar: { height: "100%", backgroundColor: "#fff", borderRadius: 10 },
  balanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  footerText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: "#fff",
    width: "48%",
    padding: 15,
    borderRadius: 20,
    elevation: 1,
  },
  statLabel: { fontSize: 11, color: "#888", marginVertical: 2 },
  statIncome: { fontSize: 16, color: "#3A6B55", fontWeight: "bold" },
  statExpense: { fontSize: 16, color: "#C25450", fontWeight: "bold" },
  todayCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 24,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
    borderLeftWidth: 5,
    borderLeftColor: "#3A6B55",
  },
  todayInfo: { flexDirection: "row", alignItems: "center" },
  todayIconContainer: {
    backgroundColor: "#F0F7F4",
    padding: 10,
    borderRadius: 12,
    marginRight: 12,
  },
  todayLabel: { fontSize: 14, fontWeight: "bold", color: "#333" },
  todayDate: { fontSize: 11, color: "#999" },
  todayValue: { fontSize: 18, fontWeight: "bold", color: "#3A6B55" },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 15,
    marginBottom: 20,
    elevation: 1,
  },
  chartTitle: {
    fontWeight: "bold",
    color: "#333",
    fontSize: 14,
    marginBottom: 10,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  filterRow: { flexDirection: "row", gap: 6 },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  filterBtnActive: { backgroundColor: "#3A6B55" },
  filterText: { fontSize: 10, fontWeight: "bold", color: "#999" },
  lineChartStyle: { marginVertical: 8, borderRadius: 16, marginLeft: -15 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  viewAllText: { color: "#3A6B55", fontWeight: "bold", fontSize: 13 },
  iponCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    marginBottom: 12,
    borderLeftWidth: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
  },
  iponInfo: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iponLabel: { fontSize: 14, fontWeight: "bold", color: "#333" },
  iponSubtitle: { fontSize: 11, color: "#999" },
  iponValue: { fontSize: 15, fontWeight: "bold", color: "#3A6B55" },
  fab: {
    position: "absolute",
    right: 25,
    bottom: 110,
    backgroundColor: "#3A6B55",
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    minHeight: 400,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 25,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  modalSubtitle: { fontSize: 12, color: "#999" },
  input: {
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 15,
    marginBottom: 15,
    fontSize: 16,
    color: "#333",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 10,
  },
  categoryPicker: { flexDirection: "row", flexWrap: "wrap", marginBottom: 25 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    marginRight: 8,
    marginBottom: 8,
  },
  catChipText: { fontSize: 12, color: "#777", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#3A6B55",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  historyListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  historyLeft: { flexDirection: "row", alignItems: "center" },
  iconCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyItemTitle: { fontWeight: "bold", fontSize: 15, color: "#333" },
  historyItemDate: { fontSize: 11, color: "#AAA" },
  historyItemAmount: { fontWeight: "bold", color: "#3A6B55", fontSize: 15 },
  emptyText: { textAlign: "center", color: "#999", marginTop: 40 },
});
