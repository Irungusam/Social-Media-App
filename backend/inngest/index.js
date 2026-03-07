import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import sendEmail from "../configs/nodemailer.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import connectDB from "../configs/db.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "pingup-app" });

// Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectDB();
    try {
      const { id, first_name, last_name, email_addresses, image_url } =
        event.data;

      console.log("Creating user with id:", id);

      let username = email_addresses[0].email_address.split("@")[0];
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        username = username + Math.floor(Math.random() * 10000);
      }

      const userData = {
        _id: id,
        email: email_addresses[0].email_address,
        full_name: first_name + " " + last_name,
        profile_picture: image_url,
        username,
      };

      console.log("Saving user:", userData);
      const newUser = await User.create(userData);
      console.log("User saved:", newUser);
    } catch (error) {
      console.error("Error creating user:", error.message);
      throw error;
    }
  },
);

// Inngest function to update user data in database
const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    await connectDB();
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;

    const updateUserData = {
      email: email_addresses[0].email_address,
      full_name: first_name + " " + last_name,
      profile_picture: image_url,
    };
    await User.findByIdAndUpdate(id, updateUserData);
  },
);

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();
    const { id } = event.data;
    await User.findByIdAndDelete(id);
  },
);

// Inngest function to send Notification when a new connection request is added
const sendNewConnectionRequestNotification = inngest.createFunction(
  { id: "send-new-connection-request-notification" },
  { event: "app/connection-request" },
  async ({ event, step }) => {
    const { connectionId } = event.data;

    await step.run("send-connection-request-email", async () => {
      await connectDB();
      const connection = await Connection.findById(connectionId).populate(
        "from_user_id to_user_id",
      );
      const subject = `New Connection Request`;
      const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hi ${connection.to_user_id.full_name},</h2>
      <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
      <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981;">here</a> to accept or reject the request</p>
      <br/>
      <p>Thanks,<br/>PingUp - Stay Connected</p>
      </div>`;

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body,
      });
    });

    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await step.sleepUntil("wait-for-24-hours", in24Hours);

    await step.run("send-connection-request-reminder", async () => {
      await connectDB();
      const connection = await Connection.findById(connectionId).populate(
        "from_user_id to_user_id",
      );

      if (connection.status === "accepted") {
        return { message: "Already accepted" };
      }

      const subject = `New Connection Request`;
      const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hi ${connection.to_user_id.full_name},</h2>
      <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
      <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981;">here</a> to accept or reject the request</p>
      <br/>
      <p>Thanks,<br/>PingUp - Stay Connected</p>
      </div>`;

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body,
      });

      return { message: "Reminder sent." };
    });
  },
);

// Inngest function to delete story after 24 hours
const deleteStory = inngest.createFunction(
  { id: "story-delete" },
  { event: "app/story.delete" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await step.sleepUntil("wait-for-24-hours", in24Hours);
    await step.run("delete-story", async () => {
      await connectDB();
      await Story.findByIdAndDelete(storyId);
      return { message: "Story deleted" };
    });
  },
);

const sendNotificationOfUnseenMessages = inngest.createFunction(
  { id: "send-unseen-messages-notification" },
  { cron: "TZ=Africa/Nairobi 0 9 * * *" }, // Every Day 9 AM
  async ({ step }) => {
    await step.run("fetch-and-send-unseen-messages", async () => {
      await connectDB();
      const messages = await Message.find({ seen: false }).populate("to_user_id");
      const unseenCount = {};

      messages.forEach((message) => {
        unseenCount[message.to_user_id._id] =
          (unseenCount[message.to_user_id._id] || 0) + 1;
      });

      for (const userId in unseenCount) {
        const user = messages.find(
          (m) => m.to_user_id._id.toString() === userId
        ).to_user_id;

        const subject = `You have ${unseenCount[userId]} unseen messages`;
        const body = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hi ${user.full_name},</h2>
        <p>You have ${unseenCount[userId]} unseen messages</p>
        <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color: #10b981;">here</a> to view them</p>
        <br/>
        <p>Thanks,<br/>PingUp - Stay Connected</p>
        </div>
        `;

        await sendEmail({
          to: user.email,
          subject,
          body,
        });
      }
      return { message: "Notification sent." };
    });
  },
);

export const functions = [
  syncUserCreation,
  syncUserUpdation,
  syncUserDeletion,
  sendNewConnectionRequestNotification,
  deleteStory,
  sendNotificationOfUnseenMessages,
];