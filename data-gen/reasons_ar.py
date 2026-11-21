"""Arabic text helpers shared by generate.py. Western digits everywhere (shared brief §3)."""

TYPE_WORD = {"theft": "سرقة", "breakin": "اقتحام", "scrap": "سكراب", "damage": "إتلاف"}
TYPE_FULL = {
    "theft": "سرقة الكيابل والمعادن",
    "breakin": "اقتحام المواقع الخالية أو قيد الإنشاء",
    "scrap": "أحواش ومستودعات السكراب المخالفة",
    "damage": "إتلاف ممتلكات «مدن»",
}
STATUS_AR = {"producing": "منتج", "under_construction": "قيد الإنشاء", "empty": "خالٍ", "closed": "مغلق"}
SITE_AR = {
    "metal": "معادن", "electrical": "كهربائيات", "warehouse": "مستودعات",
    "construction_materials": "مواد بناء", "food": "أغذية", "chemical": "كيماويات", "other": "متنوع",
}
LEVEL_AR = {1: "منخفض جداً", 2: "منخفض", 3: "متوسط", 4: "مرتفع", 5: "حرج"}
SHIFT_AR = {"morning": "الصباحية", "evening": "المسائية", "night": "الليلية"}
SHIFT_FULL_AR = {
    "morning": "الوردية الصباحية (06:00–14:00)",
    "evening": "الوردية المسائية (14:00–22:00)",
    "night": "الوردية الليلية (22:00–06:00)",
}
MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
WEEKDAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]  # date.weekday() order
NIGHTS = {5: "خمس ليالٍ", 6: "ست ليالٍ", 7: "سبع ليالٍ"}


def bal(n):
    """بلاغ with the right number agreement."""
    if n == 1:
        return "بلاغ واحد"
    if n == 2:
        return "بلاغان"
    if n <= 10:
        return f"{n} بلاغات"
    return f"{n} بلاغاً"


def zone_label(zid):
    """'Z14' -> 'المنطقة 14'"""
    return f"المنطقة {int(zid[1:])}"


def date_ar(d, weekday=False):
    s = f"{d.day} {MONTHS[d.month - 1]}"
    return f"{WEEKDAYS[d.weekday()]} {s}" if weekday else s


def range_ar(a, b):
    if a.month == b.month:
        return f"{a.day}–{b.day} {MONTHS[b.month - 1]}"
    return f"{a.day} {MONTHS[a.month - 1]} – {b.day} {MONTHS[b.month - 1]}"


def site_summary(site_type, status):
    return f"موقع {SITE_AR[site_type]} · {STATUS_AR[status]}"


def pct(x):
    return f"{x:.0f}%"
