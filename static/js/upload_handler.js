$(document).ready(function () {
	$("#uploadForm").on("submit", function (e) {
		e.preventDefault();
		const files = $("#fileInput")[0].files;

		if (!files.length) {
			alert("Please select at least one file.");
			return;
		}

		$("#uploadList").empty();

		$.each(files, function (index, file) {
			let fileId = "upload-" + Date.now() + "-" + index;
			let uploadItem = `
                        <div id="${fileId}" class="upload-item">
                            <strong>${file.name}</strong>
                            <div class="progress mt-2">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar"
                                     style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                                    0%
                                </div>
                            </div>
                        </div>`;
			$("#uploadList").append(uploadItem);

			let formData = new FormData();
			formData.append("file", file);

			// Upload one file at a time
			$.ajax({
				url: "/",
				type: "POST",
				data: formData,
				processData: false,
				contentType: false,
				xhr: function () {
					let xhr = new window.XMLHttpRequest();
					xhr.upload.addEventListener(
						"progress",
						function (evt) {
							if (evt.lengthComputable) {
								let percentComplete = Math.round(
									(evt.loaded / evt.total) * 100
								);
								$(`#${fileId} .progress-bar`)
									.attr("aria-valuenow", percentComplete)
									.css("width", percentComplete + "%")
									.text(percentComplete + "%");
							}
						},
						false
					);
					return xhr;
				},
				success: function (response) {
					$(`#${fileId} .progress-bar`)
						.removeClass("progress-bar-animated")
						.addClass("bg-success")
						.text("Uploaded!");
				},
				error: function () {
					$(`#${fileId} .progress-bar`)
						.removeClass("bg-primary progress-bar-animated")
						.addClass("bg-danger")
						.text("Failed");
				},
			});
		});
	});
});
