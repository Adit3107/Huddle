import prisma from "../src/config/prisma.js";

async function main() {
  await prisma.message.deleteMany();
  await prisma.groupUser.deleteMany();
  await prisma.chatGroup.deleteMany();
  await prisma.user.deleteMany();

  const [maya, arjun] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Maya Chen",
        email: "maya@huddle.dev",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
        provider: "google",
        providerId: "google-maya-001"
      }
    }),
    prisma.user.create({
      data: {
        name: "Arjun Mehta",
        email: "arjun@huddle.dev",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
        provider: "google",
        providerId: "google-arjun-001"
      }
    })
  ]);

  const quickRoom = await prisma.chatGroup.create({
    data: {
      title: "Design Jam Lobby",
      passcode: "483921",
      roomType: "QUICK",
      description: "Temporary room for a fast product-design review.",
      createdBy: maya.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 4),
      peakUsers: 4,
      members: {
        create: [
          {
            userId: maya.id,
            displayName: "Maya",
            isAnonymous: false,
            lastSeen: new Date()
          },
          {
            displayName: "Guest Designer",
            isAnonymous: false,
            lastSeen: new Date()
          },
          {
            displayName: "Anonymous Guest",
            isAnonymous: true,
            lastSeen: new Date()
          }
        ]
      }
    },
    include: {
      members: true
    }
  });

  const productGroup = await prisma.chatGroup.create({
    data: {
      title: "Product Core Team",
      roomType: "GROUP",
      description: "Persistent space for roadmap, launch, and support planning.",
      createdBy: arjun.id,
      expiresAt: null,
      peakUsers: 6,
      members: {
        create: [
          {
            userId: arjun.id,
            displayName: "Arjun",
            isAnonymous: false,
            lastSeen: new Date()
          },
          {
            userId: maya.id,
            displayName: "Maya",
            isAnonymous: false,
            lastSeen: new Date()
          },
          {
            displayName: "Support Guest",
            isAnonymous: false,
            lastSeen: new Date()
          }
        ]
      }
    },
    include: {
      members: true
    }
  });

  const quickMaya = quickRoom.members.find((member) => member.userId === maya.id);
  const quickGuest = quickRoom.members.find(
    (member) => member.displayName === "Guest Designer"
  );
  const quickAnonymous = quickRoom.members.find(
    (member) => member.displayName === "Anonymous Guest"
  );
  const groupArjun = productGroup.members.find((member) => member.userId === arjun.id);
  const groupMaya = productGroup.members.find((member) => member.userId === maya.id);
  const groupGuest = productGroup.members.find(
    (member) => member.displayName === "Support Guest"
  );

  if (
    !quickMaya ||
    !quickGuest ||
    !quickAnonymous ||
    !groupArjun ||
    !groupMaya ||
    !groupGuest
  ) {
    throw new Error("Seed participants were not created correctly.");
  }

  await prisma.message.createMany({
    data: [
      {
        groupId: quickRoom.id,
        senderId: quickMaya.id,
        senderName: quickMaya.displayName,
        text: "Welcome in. This room expires later today, so drop quick feedback here."
      },
      {
        groupId: quickRoom.id,
        senderId: quickGuest.id,
        senderName: quickGuest.displayName,
        text: "The share flow feels clear. I would keep the QR entry prominent."
      },
      {
        groupId: quickRoom.id,
        senderId: quickAnonymous.id,
        senderName: quickAnonymous.displayName,
        text: "Anonymous note: the passcode copy should be larger on mobile."
      },
      {
        groupId: quickRoom.id,
        senderId: quickMaya.id,
        senderName: quickMaya.displayName,
        fileUrl: "https://cdn.huddle.dev/demo/quick-room-wireframe.png",
        fileType: "image/png",
        fileName: "quick-room-wireframe.png"
      },
      {
        groupId: quickRoom.id,
        senderId: quickGuest.id,
        senderName: quickGuest.displayName,
        text: "The wireframe works. I marked the empty state and expiry banner."
      },
      {
        groupId: quickRoom.id,
        senderId: quickAnonymous.id,
        senderName: quickAnonymous.displayName,
        text: "Can we pin the final summary before the room disappears?"
      },
      {
        groupId: productGroup.id,
        senderId: groupArjun.id,
        senderName: groupArjun.displayName,
        text: "Morning team. Let us collect launch blockers in this thread."
      },
      {
        groupId: productGroup.id,
        senderId: groupMaya.id,
        senderName: groupMaya.displayName,
        text: "Database section is the priority. API work stays out until this is stable."
      },
      {
        groupId: productGroup.id,
        senderId: groupGuest.id,
        senderName: groupGuest.displayName,
        text: "Support needs read receipts eventually for high-priority group rooms."
      },
      {
        groupId: productGroup.id,
        senderId: groupArjun.id,
        senderName: groupArjun.displayName,
        fileUrl: "https://cdn.huddle.dev/demo/launch-checklist.pdf",
        fileType: "application/pdf",
        fileName: "launch-checklist.pdf"
      },
      {
        groupId: productGroup.id,
        senderId: groupMaya.id,
        senderName: groupMaya.displayName,
        text: "Noted. The message model keeps room, sender, text, and file data separate."
      },
      {
        groupId: productGroup.id,
        senderId: groupGuest.id,
        senderName: groupGuest.displayName,
        text: "Great. That should leave room for edits, replies, and reactions later."
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
