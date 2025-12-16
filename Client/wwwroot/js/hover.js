
window.setupSlotHover = (dotNetHelper) => {
    document.addEventListener('mouseover', (e) => {
        const slot = e.target.closest('.rz-slot');
        if (slot) {
            const title = slot.getAttribute('title');
            if (title) {
                dotNetHelper.invokeMethodAsync('OnSlotHover', title);
            } else {
                dotNetHelper.invokeMethodAsync('OnSlotHover', "");
            }
        }
    });
};
