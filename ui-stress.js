(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  if (params.get("ui-test") !== "1") return;
  const mode = params.get("data") || "demo";
  document.documentElement.dataset.uiStress = mode;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const addDays = (source, amount) => {
    const date = new Date(`${source}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };

  function applyWorstCase(data) {
    data.metadata.title = "中国香港特别行政区 × Phú Quốc × Thành phố Hồ Chí Minh 跨城市慢旅计划";
    data.trip.heroTitle = "中国香港特别行政区 × 越南胡志明市与富国岛";

    const firstFlight = data.flights?.[0];
    if (firstFlight) {
      firstFlight.airline.nameZh = "中国国际航空股份有限公司 · 山东航空集团有限公司联程执飞";
      firstFlight.departure.city = "中国香港特别行政区赤鱲角";
      firstFlight.arrival.city = "Thành phố Hồ Chí Minh";
    }

    const firstRail = data.groundTransport?.publicTransitAndRail?.[0];
    if (firstRail) {
      firstRail.departure.station = "北京西站高速铁路长途旅客出发站";
      firstRail.arrival.station = "深圳北站港澳旅客综合换乘中心";
      firstRail.serviceNumber = "G897 / 深夜长途联程";
    }

    const firstDay = data.days?.[0];
    if (firstDay) {
      firstDay.title = "抵达中国香港特别行政区后的跨区城市漫步与夜间维多利亚港行程";
      firstDay.locations = [
        "深圳北站港澳旅客综合换乘中心",
        "YHA 美荷楼青年旅舍 Heritage of Mei Ho House Youth Hostel",
        "尖沙咀海滨花园与维多利亚港夜景步道"
      ];
      const firstItem = firstDay.schedule?.[0];
      if (firstItem) {
        firstItem.text = "从站内指引标识前往跨境换乘通道，确认车票、行李与后续公共交通路线；如果扶梯拥挤，请预留额外步行时间。Đặng Thị Ngọc Hân 👩🏽‍💻";
        firstItem.url = "https://example.com/workspaces/travel/projects/hong-kong-vietnam/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved";
      }
    }
  }

  function applyCollectionMode(data) {
    if (mode === "worst") return applyWorstCase(data);
    if (mode === "empty") {
      data.flightJourneys = [];
      data.flights = [];
      if (data.groundTransport) data.groundTransport.publicTransitAndRail = [];
      data.transportOrder = [];
      data.days = [];
      data.trip.dayCount = 0;
      return;
    }
    if (mode === "one") {
      data.flightJourneys = (data.flightJourneys || []).slice(0, 1);
      const journeyId = data.flightJourneys[0]?.id;
      data.flights = (data.flights || []).filter((flight) => flight.journeyId === journeyId);
      if (data.groundTransport) data.groundTransport.publicTransitAndRail = [];
      data.transportOrder = journeyId ? [`flight:${journeyId}`] : [];
      data.days = (data.days || []).slice(0, 1);
      if (data.days[0]) data.days[0].schedule = (data.days[0].schedule || []).slice(0, 1);
      data.trip.dayCount = data.days.length;
      return;
    }
    if (mode === "1000") {
      const source = clone(data.days?.[0] || { day: 1, date: "2026-11-21", title: "待补充", locations: [], schedule: [] });
      data.days = Array.from({ length: 1000 }, (_, index) => {
        const day = clone(source);
        day.day = index + 1;
        day.date = addDays(source.date, index);
        day.title = `${source.title} · ${index + 1}`;
        day.schedule = (day.schedule || []).map((item, itemIndex) => ({ ...item, id: `${item.id || "item"}-${index}-${itemIndex}` }));
        return day;
      });
      data.trip.dayCount = 1000;
    }
  }

  document.addEventListener("travel-data-ready", (event) => applyCollectionMode(event.detail), { once: true });

  document.addEventListener("DOMContentLoaded", () => {
    const labels = [["demo", "Demo"], ["worst", "Worst case"], ["empty", "Empty"], ["one", "One"], ["1000", "1,000 rows"]];
    const nav = document.createElement("nav");
    nav.className = "ui-stress-switch";
    nav.setAttribute("aria-label", "UI stress data");
    labels.forEach(([value, label]) => {
      const url = new URL(location.href);
      url.searchParams.set("ui-test", "1");
      url.searchParams.set("data", value);
      const link = document.createElement("a");
      link.href = url.href;
      link.textContent = label;
      if (mode === value) link.setAttribute("aria-current", "true");
      nav.append(link);
    });
    document.body.append(nav);
  });
})();
