
const ROOM_TYPES = {
    Standard: { price: 1500, count: 8, capacity: 2 },
    Deluxe: { price: 2500, count: 7, capacity: 3 },
    Suite: { price: 4000, count: 5, capacity: 4 }
};

let currentUser = sessionStorage.getItem("unitedUser");
let foodCart = [];

// ---------- DATE HELPERS ----------

function getToday() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function calculateNights(start, end) {
    return Math.round(
        (new Date(end + "T00:00:00") -
         new Date(start + "T00:00:00")) / 86400000
    );
}

// ---------- LOCAL STORAGE ----------

function getUsers() {
    return JSON.parse(localStorage.getItem("uhUsers")) || [];
}

function getRecords() {
    return JSON.parse(localStorage.getItem("uhRecords")) || {};
}

function saveRecords(records) {
    localStorage.setItem("uhRecords", JSON.stringify(records));
}

function getMyRecords() {
    const records = getRecords();

    if (!records[currentUser]) {
        records[currentUser] = {
            bookings: [],
            orders: []
        };

        saveRecords(records);
    }

    return records[currentUser];
}

function getAllBookings() {
    const records = getRecords();

    return Object.values(records).flatMap(
        userRecords => userRecords.bookings || []
    );
}

// ---------- LOGIN AND REGISTRATION ----------

function showAuth(type) {
    document.getElementById("loginForm").classList.toggle(
        "hidden", type !== "login"
    );

    document.getElementById("registerForm").classList.toggle(
        "hidden", type !== "register"
    );

    document.getElementById("loginTab").classList.toggle(
        "active", type === "login"
    );

    document.getElementById("registerTab").classList.toggle(
        "active", type === "register"
    );
}

document.getElementById("registerForm").addEventListener(
    "submit", function(event) {
        event.preventDefault();

        const name = document.getElementById("regName").value.trim();
        const email = document.getElementById("regEmail").value
            .trim().toLowerCase();
        const password = document.getElementById("regPassword").value;

        if (name.length < 2) {
            alert("Please enter a valid name.");
            return;
        }

        const users = getUsers();

        if (users.some(user => user.email === email)) {
            alert("This email is already registered. Please login.");
            return;
        }

        users.push({ name, email, password });

        localStorage.setItem("uhUsers", JSON.stringify(users));

        alert("Registration successful! Please login.");
        this.reset();
        showAuth("login");
    }
);

document.getElementById("loginForm").addEventListener(
    "submit", function(event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value
            .trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        const user = getUsers().find(
            item => item.email === email &&
                    item.password === password
        );

        if (!user) {
            alert("Incorrect email or password.");
            return;
        }

        currentUser = user.email;
        sessionStorage.setItem("unitedUser", currentUser);

        foodCart = [];
        this.reset();
        showDashboard();
    }
);

// ---------- DASHBOARD ----------

function showDashboard() {
    const user = getUsers().find(
        item => item.email === currentUser
    );

    if (!user) {
        logout();
        return;
    }

    document.getElementById("welcomePage").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    document.getElementById("welcomeUser").textContent =
        "Hello, " + user.name;

    document.getElementById("checkIn").min = getToday();
    document.getElementById("checkOut").min = getToday();

    renderDashboard();
    renderBookings();
    renderFoodCart();
    renderBill();
    renderFeedback();
}

function logout() {
    sessionStorage.removeItem("unitedUser");
    currentUser = null;
    foodCart = [];

    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("welcomePage").classList.remove("hidden");

    showAuth("login");
}

// ---------- ROOM AVAILABILITY ----------

// Two date ranges overlap when each begins before the other ends.
function datesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

function isRoomFree(roomNumber, start, end) {
    return !getAllBookings().some(booking => {
        return booking.roomNumber === roomNumber &&
            booking.status !== "Checked Out" &&
            datesOverlap(
                start, end,
                booking.checkIn, booking.checkOut
            );
    });
}

function getFreeRoomNumber(roomType, start, end) {
    const prefix = {
        Standard: "S",
        Deluxe: "D",
        Suite: "L"
    }[roomType];

    const roomCount = ROOM_TYPES[roomType].count;

    for (let i = 1; i <= roomCount; i++) {
        const roomNumber = prefix + String(i).padStart(2, "0");

        if (isRoomFree(roomNumber, start, end)) {
            return roomNumber;
        }
    }

    return null;
}

// Dashboard statistics for the current date
function renderDashboard() {
    const today = getToday();
    const allBookings = getAllBookings();

    const occupiedBookings = allBookings.filter(booking =>
        booking.status !== "Checked Out" &&
        booking.checkIn <= today &&
        booking.checkOut > today
    );

    const bookedRooms = new Set(
        occupiedBookings.map(booking => booking.roomNumber)
    ).size;

    document.getElementById("totalRooms").textContent = "20";
    document.getElementById("availableRooms").textContent =
        20 - bookedRooms;
    document.getElementById("bookedRooms").textContent = bookedRooms;
    document.getElementById("roomTypes").textContent =
        Object.keys(ROOM_TYPES).length;
    document.getElementById("totalMembers").textContent =
        getUsers().length;
}

// Update checkout date after check-in changes
document.getElementById("checkIn").addEventListener(
    "change", function() {
        const checkout = document.getElementById("checkOut");

        checkout.min = this.value || getToday();

        if (checkout.value && checkout.value <= this.value) {
            checkout.value = "";
        }
    }
);

// ---------- ROOM BOOKING ----------

document.getElementById("bookingForm").addEventListener(
    "submit", function(event) {
        event.preventDefault();

        const roomType = document.getElementById("roomType").value;
        const checkIn = document.getElementById("checkIn").value;
        const checkOut = document.getElementById("checkOut").value;
        const guests = Number(document.getElementById("guests").value);

        if (!checkIn || !checkOut || checkIn < getToday()) {
            alert("Please select valid booking dates.");
            return;
        }

        if (checkOut <= checkIn) {
            alert("Check-out must be after check-in.");
            return;
        }

        if (guests > ROOM_TYPES[roomType].capacity) {
            alert(
                roomType + " rooms allow up to " +
                ROOM_TYPES[roomType].capacity + " guests."
            );
            return;
        }

        const roomNumber = getFreeRoomNumber(
            roomType, checkIn, checkOut
        );

        if (!roomNumber) {
            alert("No " + roomType +
                " room is available for these dates.");
            return;
        }

        const nights = calculateNights(checkIn, checkOut);
        const total = nights * ROOM_TYPES[roomType].price;

        const booking = {
            id: Date.now(),
            roomType,
            roomNumber,
            checkIn,
            checkOut,
            guests,
            nights,
            total,
            status: "Booked",
            paid: false
        };

        const records = getRecords();

        if (!records[currentUser]) {
            records[currentUser] = {
                bookings: [],
                orders: []
            };
        }

        records[currentUser].bookings.push(booking);
        saveRecords(records);

        alert(
            "Room booked successfully!\n" +
            "Room Number: " + roomNumber + "\n" +
            "Nights: " + nights + "\n" +
            "Room Bill: ₹" + total
        );

        this.reset();
        document.getElementById("checkIn").min = getToday();
        document.getElementById("checkOut").min = getToday();

        renderDashboard();
        renderBookings();
        renderBill();
    }
);

// ---------- FOOD ORDERING ----------

// Add an item; repeated items increase quantity
function addFood(name, price) {
    if (!currentUser) return;

    const existing = foodCart.find(item => item.name === name);

    if (existing) {
        existing.quantity++;
    } else {
        foodCart.push({ name, price, quantity: 1 });
    }

    renderFoodCart();
}

function renderFoodCart() {
    const cart = document.getElementById("foodCart");
    const totalElement = document.getElementById("foodTotal");

    cart.replaceChildren();

    if (foodCart.length === 0) {
        cart.textContent = "No food items added.";
        totalElement.textContent = "Food Total: ₹0";
        return;
    }

    foodCart.forEach((item, index) => {
        const line = document.createElement("p");
        const description = document.createElement("span");

        description.textContent =
            item.name + " × " + item.quantity +
            " = ₹" + (item.price * item.quantity);

        const remove = document.createElement("button");
        remove.textContent = "Remove";
        remove.type = "button";

        remove.addEventListener("click", () => {
            foodCart.splice(index, 1);
            renderFoodCart();
        });

        line.append(description, remove);
        cart.appendChild(line);
    });

    const total = foodCart.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
    );

    totalElement.textContent = "Food Total: ₹" + total;
}

function placeFoodOrder() {
    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    if (foodCart.length === 0) {
        alert("Please add food items first.");
        return;
    }

    const records = getRecords();
    const order = {
        id: Date.now(),
        items: foodCart.map(item => ({ ...item })),
        total: foodCart.reduce(
            (sum, item) => sum + item.price * item.quantity, 0
        ),
        date: getToday(),
        status: "Order Placed",
        paid: false
    };

    if (!records[currentUser]) {
        records[currentUser] = { bookings: [], orders: [] };
    }

    records[currentUser].orders.push(order);
    saveRecords(records);

    foodCart = [];
    renderFoodCart();
    renderBookings();
    renderBill();

    alert("Food order confirmed!");
}

// ---------- BOOKING HISTORY ----------

function renderBookings() {
    const container = document.getElementById("myBookings");
    const records = getMyRecords();

    container.replaceChildren();

    if (records.bookings.length === 0 &&
        records.orders.length === 0) {
        container.textContent = "No bookings or orders yet.";
        return;
    }

    function createCard(title, details) {
        const card = document.createElement("div");
        card.className = "booking-item";

        const heading = document.createElement("h3");
        heading.textContent = title;
        card.appendChild(heading);

        details.forEach(text => {
            const paragraph = document.createElement("p");
            paragraph.textContent = text;
            card.appendChild(paragraph);
        });

        container.appendChild(card);
    }

    records.bookings.slice().reverse().forEach(booking => {
        createCard("Room Booking #" + booking.id, [
            "Room: " + booking.roomType +
                " (" + booking.roomNumber + ")",
            "Check-in: " + booking.checkIn,
            "Check-out: " + booking.checkOut,
            "Guests: " + booking.guests,
            "Nights: " + booking.nights,
            "Room Bill: ₹" + booking.total,
            "Status: " + booking.status,
            "Payment: " + (booking.paid ? "Paid" : "Unpaid")
        ]);
    });

    records.orders.slice().reverse().forEach(order => {
        const names = order.items.map(item =>
            item.name + " × " + item.quantity
        ).join(", ");

        createCard("Food Order #" + order.id, [
            "Items: " + names,
            "Date: " + order.date,
            "Food Bill: ₹" + order.total,
            "Status: " + order.status,
            "Payment: " + (order.paid ? "Paid" : "Unpaid")
        ]);
    });
}

// ---------- FINAL BILL AND CHECKOUT ----------

function renderBill() {
    const bill = document.getElementById("billDetails");
    const grandTotal = document.getElementById("grandTotal");
    const checkoutButton = document.getElementById("checkoutBtn");

    const records = getMyRecords();
    bill.replaceChildren();

    let total = 0;
    let unpaidCount = 0;

    function addBillLine(description, amount) {
        const line = document.createElement("div");
        line.className = "bill-line";

        const label = document.createElement("span");
        label.textContent = description;

        const value = document.createElement("strong");
        value.textContent = "₹" + amount;

        line.append(label, value);
        bill.appendChild(line);
    }

    records.bookings.filter(item => !item.paid).forEach(booking => {
        addBillLine(
            booking.roomType + " / " + booking.roomNumber +
            " (" + booking.nights + " nights)",
            booking.total
        );

        total += booking.total;
        unpaidCount++;
    });

    records.orders.filter(item => !item.paid).forEach(order => {
        order.items.forEach(item => {
            addBillLine(
                item.name + " × " + item.quantity,
                item.price * item.quantity
            );
        });

        total += order.total;
        unpaidCount++;
    });

    if (unpaidCount === 0) {
        bill.textContent = "No unpaid bills. You are all clear!";
    }

    grandTotal.textContent = "₹" + total;
    checkoutButton.disabled = unpaidCount === 0;
    checkoutButton.style.opacity = unpaidCount === 0 ? "0.5" : "1";
}

function checkout() {
    const records = getRecords();
    const mine = records[currentUser];

    if (!mine) return;

    const unpaidBookings = mine.bookings.filter(item => !item.paid);
    const unpaidOrders = mine.orders.filter(item => !item.paid);

    if (unpaidBookings.length === 0 && unpaidOrders.length === 0) {
        alert("There is no unpaid bill.");
        return;
    }

    const total =
        unpaidBookings.reduce((sum, item) => sum + item.total, 0) +
        unpaidOrders.reduce((sum, item) => sum + item.total, 0);

    const confirmed = confirm(
        "Final Bill: ₹" + total +
        "\nThis is a demo checkout. No real payment will occur." +
        "\nMark this bill as paid?"
    );

    if (!confirmed) return;

    unpaidBookings.forEach(booking => {
        booking.paid = true;
        booking.status = "Checked Out";
    });

    unpaidOrders.forEach(order => {
        order.paid = true;
        order.status = "Completed";
    });

    saveRecords(records);

    renderDashboard();
    renderBookings();
    renderBill();

    alert("Demo checkout completed. Thank you for visiting!");
}

// ---------- FEEDBACK ----------

function getFeedback() {
    return JSON.parse(localStorage.getItem("uhFeedback")) || [];
}

document.getElementById("feedbackForm").addEventListener(
    "submit", function(event) {
        event.preventDefault();

        if (!currentUser) {
            alert("Please login first.");
            return;
        }

        const rating = Number(
            document.getElementById("rating").value
        );

        const message = document.getElementById(
            "feedbackMessage"
        ).value.trim();

        if (rating < 1 || rating > 5 || !message) {
            alert("Please select a rating and write your feedback.");
            return;
        }

        const user = getUsers().find(
            item => item.email === currentUser
        );

        if (!user) {
            alert("Please login again.");
            logout();
            return;
        }

        const feedback = getFeedback();

        feedback.push({
            name: user.name,
            rating,
            message,
            date: getToday()
        });

        localStorage.setItem("uhFeedback", JSON.stringify(feedback));

        alert("Thank you for your valuable feedback!");
        this.reset();
        renderFeedback();
    }
);

function renderFeedback() {
    const list = document.getElementById("feedbackList");
    const feedback = getFeedback();

    list.replaceChildren();

    if (feedback.length === 0) {
        list.textContent = "No reviews yet.";
        return;
    }

    feedback.slice().reverse().forEach(item => {
        const card = document.createElement("div");
        card.className = "feedback-item";

        const name = document.createElement("h4");
        name.textContent = item.name;

        const stars = document.createElement("p");
        stars.className = "feedback-stars";
        stars.textContent =
            "★".repeat(item.rating) +
            "☆".repeat(5 - item.rating);

        const message = document.createElement("p");
        message.textContent = item.message;

        const date = document.createElement("small");
        date.textContent = "Date: " + item.date;

        card.append(name, stars, message, date);
        list.appendChild(card);
    });
}

// ---------- INITIAL STARTUP ----------

if (currentUser &&
    !getUsers().some(user => user.email === currentUser)) {
    sessionStorage.removeItem("unitedUser");
    currentUser = null;
}

if (currentUser) {
    showDashboard();
} else {
    showAuth("login");
}
