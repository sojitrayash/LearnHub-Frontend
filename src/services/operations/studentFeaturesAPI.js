import { toast } from "react-hot-toast";
import { studentEndpoints } from "../apis";
import { apiConnector } from "../apiConnector";
import rzpLogo from "../../assets/Logo/logo2.svg"
import { setPaymentLoading } from "../../slices/courseSlice";
import { resetCart } from "../../slices/cartSlice";


const { COURSE_PAYMENT_API, COURSE_VERIFY_API, SEND_PAYMENT_SUCCESS_EMAIL_API } = studentEndpoints;

function loadScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;

        script.onload = () => {
            resolve(true);
        }
        script.onerror = () => {
            resolve(false);
        }
        document.body.appendChild(script);
    })
}

// ================ buyCourse ================ 
// ================ buyCourse ================ 
// ================ buyCourse (Corrected and Complete) ================ 
export async function buyCourse(token, coursesId, userDetails, navigate, dispatch) {
    const toastId = toast.loading("Loading...");

    try {
        // 1. Load the Razorpay SDK script
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");

        if (!res) {
            toast.error("Razorpay SDK failed to load. Please check your internet connection.");
            toast.dismiss(toastId);
            return;
        }

        // 2. Initiate the payment order by calling the backend
        const orderResponse = await apiConnector("POST", COURSE_PAYMENT_API,
            { coursesId },
            {
                Authorization: `Bearer ${token}`,
            });

        if (!orderResponse.data.success) {
            throw new Error(orderResponse.data.message);
        }
        
        // 3. Get the order details and key_id from the backend's response
        const { order, key_id } = orderResponse.data;

        // 4. Create the Razorpay options object
        const options = {
            key: key_id,
            currency: order.currency,
            amount: order.amount,
            order_id: order.id,
            name: "LearnHub",
            description: "Thank you for Purchasing the Course",
            image: rzpLogo,
            prefill: {
                name: `${userDetails.firstName} ${userDetails.lastName}`,
                email: userDetails.email
            },
            // This handler function runs after the payment is completed
            handler: function (response) {
                // Send a payment success email
                sendPaymentSuccessEmail(response, order.amount, token);
                // Verify the payment on the backend to enroll the student
                verifyPayment({ ...response, coursesId }, token, navigate, dispatch);
            }
        };

        // 5. Open the Razorpay payment window
        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        
        // Handle payment failure
        paymentObject.on("payment.failed", function (response) {
            toast.error("Oops, payment failed.");
            console.log("Payment failure response:", response.error);
        });

    } catch (error) {
        console.log("PAYMENT API ERROR.....", error);
        // Use the error message from the backend if available
        toast.error(error.response?.data?.message || "Could not make payment.");
    }
    
    toast.dismiss(toastId);
}

// ================ send Payment Success Email ================
async function sendPaymentSuccessEmail(response, amount, token) {
    try {
        await apiConnector("POST", SEND_PAYMENT_SUCCESS_EMAIL_API, {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            amount,
        }, {
            Authorization: `Bearer ${token}`
        })
    }
    catch (error) {
        console.log("PAYMENT SUCCESS EMAIL ERROR....", error);
    }
}


// ================ verify payment ================
async function verifyPayment(bodyData, token, navigate, dispatch) {
    const toastId = toast.loading("Verifying Payment....");
    dispatch(setPaymentLoading(true));

    try {
        const response = await apiConnector("POST", COURSE_VERIFY_API, bodyData, {
            Authorization: `Bearer ${token}`,
        })

        if (!response.data.success) {
            throw new Error(response.data.message);
        }
        toast.success("payment Successful, you are addded to the course");
        navigate("/dashboard/enrolled-courses");
        dispatch(resetCart());
    }
    catch (error) {
        console.log("PAYMENT VERIFY ERROR....", error);
        toast.error("Could not verify Payment");
    }
    toast.dismiss(toastId);
    dispatch(setPaymentLoading(false));
}