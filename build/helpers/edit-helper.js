export const editHelper = async (fn, ctx) => {
    try {
        await fn();
    }
    catch (err) {
        console.log(err);
        ctx.reply(JSON.stringify(err));
    }
};
//# sourceMappingURL=edit-helper.js.map